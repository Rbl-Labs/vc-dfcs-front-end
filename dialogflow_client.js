// dialogflow_client.js
// Updated with continuous conversation mode and audio response handling

class DialogflowClient {
    constructor() {
        // WebSocket configuration
        this.wsUrl = 'wss://voice-chat-dialogflow-115999300977.europe-west4.run.app/ws';
        this.websocket = null;
        this.isConnected = false;
        this.sessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Audio components
        this.audioRecorder = null;
        this.audioPlayer = null;
        this.isRecording = false;
        this.isPlaying = false;
        this.isContinuousMode = false; // NEW: Continuous conversation mode
        
        // UI elements
        this.talkButton = null;
        this.textInput = null;
        this.sendButton = null;
        this.conversationContainer = null;
        
        console.log('🤖 DialogflowClient initialized');
    }
    
    async initialize() {
        console.log('🚀 Initializing Dialogflow client...');
        
        try {
            // Initialize UI elements
            this.initializeUIElements();
            
            // Initialize audio components
            await this.initializeAudio();
            
            // Connect to WebSocket
            await this.connect();
            
            // Set up event listeners
            this.setupEventListeners();
            
            console.log('✅ Dialogflow client initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Dialogflow client:', error);
            throw error;
        }
    }
    
    initializeUIElements() {
        this.talkButton = document.getElementById('talk-button');
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-text');
        this.conversationContainer = document.getElementById('conversation-container');
        
        if (!this.talkButton || !this.textInput || !this.sendButton || !this.conversationContainer) {
            throw new Error('Required UI elements not found');
        }
        
        console.log('✅ UI elements initialized');
    }
    
    async initializeAudio() {
        console.log('🎤 Initializing audio components...');
        
        try {
            // Initialize audio recorder
            this.audioRecorder = new AdvancedAudioRecorder({
                sampleRate: 16000,
                channelCount: 1,
                bufferSize: 4096
            });
            
            await this.audioRecorder.initialize();
            
            // Initialize audio player
            this.audioPlayer = new PCMStreamPlayer({
                sampleRate: 24000,
                channelCount: 1
            });
            
            await this.audioPlayer.initialize();
            
            console.log('✅ Audio components initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize audio:', error);
            throw error;
        }
    }
    
    async connect() {
        console.log('🔗 Connecting to Dialogflow WebSocket...');
        
        return new Promise((resolve, reject) => {
            try {
                this.websocket = new WebSocket(this.wsUrl);
                
                this.websocket.onopen = (event) => {
                    console.log('✅ Connected to Dialogflow WebSocket');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.updateConnectionStatus('Connected', 'connected');
                    this.enableUI();
                    resolve();
                };
                
                this.websocket.onmessage = (event) => {
                    this.handleMessage(event);
                };
                
                this.websocket.onclose = (event) => {
                    console.log('🔌 WebSocket connection closed');
                    this.isConnected = false;
                    this.updateConnectionStatus('Disconnected', 'disconnected');
                    this.disableUI();
                    
                    // Stop recording if active
                    if (this.isRecording) {
                        this.stopRecording();
                    }
                    
                    // Attempt reconnection
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                        setTimeout(() => this.connect().catch(console.error), 2000);
                    }
                };
                
                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.updateConnectionStatus('Connection Error', 'disconnected');
                    reject(error);
                };
                
                // Connection timeout
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                console.error('❌ Failed to create WebSocket connection:', error);
                reject(error);
            }
        });
    }
    
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 Received message:', message.type, message);
            
            switch (message.type) {
                case 'connection':
                    this.sessionId = message.sessionId;
                    console.log(`📞 Session established: ${this.sessionId}`);
                    break;
                    
                case 'session':
                    if (message.status === 'ready') {
                        console.log('🎯 Session ready:', message.config);
                        this.sendSessionMessage();
                    }
                    break;
                    
                case 'text_response':
                    this.handleTextResponse(message);
                    // If text response also has audio, it will be handled by 'dialogflow_audio_data'
                    break;
                    
                case 'dialogflow_audio_data':
                    this.handleDialogflowAudioData(message);
                    break;
                    
                // We can comment out or remove the old 'audio_response' if it's no longer used
                // case 'audio_response':
                //     this.handleAudioResponse(message);
                //     break;

                case 'audio_received':
                case 'audio_chunk_received':
                    console.log('🎤 Audio acknowledged');
                    break;
                    
                case 'error':
                    console.error('❌ Server error:', message.message);
                    this.displayError(message.message);
                    break;
                    
                default:
                    console.log('❓ Unknown message type:', message.type);
            }
            
        } catch (error) {
            console.error('❌ Error parsing message:', error);
        }
    }

    handleDialogflowAudioData(message) {
        console.log('🔊 Handling Dialogflow audio data:', message);
        if (message.audioData && message.audioConfig && this.audioPlayer && this.audioPlayer.isInitialized) {
            if (this.audioPlayer.sampleRate !== message.audioConfig.sampleRate) {
                console.warn(`PCMPlayer configured for ${this.audioPlayer.sampleRate} Hz but received audio at ${message.audioConfig.sampleRate} Hz. Re-initializing player.`);
                // Potentially re-initialize or adjust player if sample rates differ significantly
                // For now, we assume PCMStreamPlayer handles resampling or was initialized for 24000 Hz
            }

            try {
                // Decode base64 string to ArrayBuffer
                const byteString = atob(message.audioData);
                const byteArray = new Uint8Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) {
                    byteArray[i] = byteString.charCodeAt(i);
                }
                const wavArrayBuffer = byteArray.buffer;

                // Standard WAV PCM header is 44 bytes.
                // PCMStreamPlayer's playPCMData expects raw PCM data.
                if (wavArrayBuffer.byteLength > 44) {
                    const pcmArrayBuffer = wavArrayBuffer.slice(44); // Skip WAV header
                    
                    // Ensure audio context is running (e.g., after user interaction)
                    if (this.audioPlayer.audioContext.state === 'suspended') {
                        this.audioPlayer.audioContext.resume().then(() => {
                            console.log('AudioContext resumed for playback.');
                            this.audioPlayer.playPCMData(pcmArrayBuffer);
                        });
                    } else {
                        this.audioPlayer.playPCMData(pcmArrayBuffer);
                    }
                    console.log('▶️ Playing Dialogflow audio response via PCMStreamPlayer.');

                } else {
                    console.warn('⚠️ Received audio data is too short to be a valid WAV file (after header removal). Length:', wavArrayBuffer.byteLength);
                }

            } catch (e) {
                console.error('❌ Error processing or playing Dialogflow audio data:', e);
                this.displayError('Failed to play audio response.');
            }
        } else {
            let reason = "Cannot play Dialogflow audio: ";
            if (!message.audioData) reason += "No audio data. ";
            if (!message.audioConfig) reason += "No audio config. ";
            if (!this.audioPlayer || !this.audioPlayer.isInitialized) reason += "Audio player not ready.";
            console.warn(reason, message);
            this.displayError('Audio response could not be played.');
        }
    }
    
    sendSessionMessage() {
        if (this.websocket && this.isConnected) {
            const message = {
                type: 'session',
                action: 'initialize',
                timestamp: new Date().toISOString()
            };
            
            this.websocket.send(JSON.stringify(message));
            console.log('📤 Session message sent');
        }
    }
    
    setupEventListeners() {
        console.log('🎛️ Setting up event listeners...');
        
        // UPDATED: Talk button - toggle mode instead of push-to-talk
        this.talkButton.addEventListener('click', () => this.toggleConversationMode());
        
        // Remove old push-to-talk listeners
        // this.talkButton.addEventListener('mousedown', () => this.startRecording());
        // this.talkButton.addEventListener('mouseup', () => this.stopRecording());
        
        // Text input
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });
        
        this.sendButton.addEventListener('click', () => this.sendTextMessage());
        
        // Clear conversation
        document.getElementById('clear-conversation').addEventListener('click', () => {
            this.clearConversation();
        });
        
        console.log('✅ Event listeners set up');
    }
    
    // NEW: Toggle between continuous conversation and idle mode
    async toggleConversationMode() {
        if (!this.isConnected) return;
        
        if (this.isContinuousMode) {
            // Stop continuous mode
            await this.stopConversationMode();
        } else {
            // Start continuous mode
            await this.startConversationMode();
        }
    }
    
    async startConversationMode() {
        console.log('🎤 Starting continuous conversation mode...');
        
        try {
            this.isContinuousMode = true;
            this.talkButton.classList.add('recording');
            this.updateButtonText('Stop', '🛑');
            this.updateVoiceStatus('Listening continuously...', true);
            this.showAudioVisualizer();
            
            // Start continuous recording
            await this.startRecording();
            
        } catch (error) {
            console.error('❌ Failed to start conversation mode:', error);
            this.isContinuousMode = false;
            this.updateButtonText('Start Conversation', '🎤');
            this.updateVoiceStatus('Failed to start', false);
        }
    }
    
    async stopConversationMode() {
        console.log('🛑 Stopping continuous conversation mode...');
        
        try {
            this.isContinuousMode = false;
            this.talkButton.classList.remove('recording');
            this.updateButtonText('Start Conversation', '🎤');
            this.updateVoiceStatus('Ready to start conversation', false);
            this.hideAudioVisualizer();
            
            // Stop recording
            await this.stopRecording();
            
        } catch (error) {
            console.error('❌ Failed to stop conversation mode:', error);
        }
    }
    
    async startRecording() {
        if (!this.isConnected || this.isRecording) return;
        
        console.log('🎤 Starting recording...');
        
        try {
            this.isRecording = true;
            
            // Start audio recording
            await this.audioRecorder.startRecording();
            
            // Set up audio data handler
            this.audioRecorder.onAudioData = (audioData) => {
                if (this.websocket && this.isConnected) {
                    // Send raw audio data
                    this.websocket.send(audioData);
                }
            };
            
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.isRecording = false;
            throw error;
        }
    }
    
    async stopRecording() {
        if (!this.isRecording) return;
        
        console.log('🛑 Stopping recording...');
        
        try {
            this.isRecording = false;
            
            // Stop audio recording
            await this.audioRecorder.stopRecording();
            
            // Send end of audio signal
            if (this.websocket && this.isConnected) {
                const endMessage = {
                    type: 'audio_end',
                    timestamp: new Date().toISOString()
                };
                this.websocket.send(JSON.stringify(endMessage));
            }
            
        } catch (error) {
            console.error('❌ Failed to stop recording:', error);
        }
    }
    
    sendTextMessage() {
        const text = this.textInput.value.trim();
        if (!text || !this.isConnected) return;
        
        console.log('💬 Sending text message:', text);
        
        // Display user message
        this.displayMessage('user', text);
        
        // Send to Dialogflow
        const message = {
            type: 'text',
            text: text,
            timestamp: new Date().toISOString()
        };
        
        this.websocket.send(JSON.stringify(message));
        
        // Clear input
        this.textInput.value = '';
        
        // Show processing state
        this.updateVoiceStatus('Processing...', false);
    }
    
    handleTextResponse(message) {
        console.log('💬 Handling text response:', message.response);
        
        // Display assistant response
        this.displayMessage('assistant', message.response.text);
        
        // Update status
        if (this.isContinuousMode) {
            this.updateVoiceStatus('Listening continuously...', true);
        } else {
            this.updateVoiceStatus('Ready to talk', false);
        }
        
        // Log additional info
        if (message.response.intent) {
            console.log('🎯 Intent detected:', message.response.intent);
        }
        
        if (message.response.parameters) {
            console.log('📊 Parameters:', message.response.parameters);
        }
    }
    
    // NEW: Handle audio responses from Dialogflow
    handleAudioResponse(message) {
        console.log('🔊 Handling audio response:', message);
        
        try {
            if (message.audioData) {
                // Decode base64 audio data
                const audioData = atob(message.audioData);
                const uint8Array = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    uint8Array[i] = audioData.charCodeAt(i);
                }
                
                // Play audio response
                this.audioPlayer.playPCMData(uint8Array.buffer);
                console.log('🔊 Playing audio response');
                
                // Also display text if available
                if (message.text) {
                    this.displayMessage('assistant', message.text);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to handle audio response:', error);
        }
    }
    
    displayMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? '👤' : '🤖';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const messageText = document.createElement('p');
        messageText.textContent = content;
        messageContent.appendChild(messageText);
        
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        timestamp.style.fontSize = '0.75rem';
        timestamp.style.color = 'var(--text-secondary)';
        timestamp.style.marginTop = '0.5rem';
        messageContent.appendChild(timestamp);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        // Remove welcome message if it exists
        const welcomeMessage = this.conversationContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        this.conversationContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        this.conversationContainer.scrollTop = this.conversationContainer.scrollHeight;
    }
    
    displayError(errorMessage) {
        this.displayMessage('assistant', `❌ Error: ${errorMessage}`);
    }
    
    clearConversation() {
        this.conversationContainer.innerHTML = `
            <div class="welcome-message">
                <div class="message-content">
                    <h3>👋 Welcome to Konverter.ai Voice Assistant!</h3>
                    <p>I can help you with:</p>
                    <ul>
                        <li>📅 Checking and scheduling calendar appointments</li>
                        <li>📊 Reading and updating Google Sheets</li>
                        <li>📄 Accessing Google Docs content</li>
                        <li>🔍 Searching Google Drive files</li>
                        <li>📋 Reading PDF documents</li>
                    </ul>
                    <p>Click <strong>Start Conversation</strong> to begin talking!</p>
                </div>
            </div>
        `;
    }
    
    updateConnectionStatus(status, state) {
        const statusElement = document.getElementById('connection-status');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        statusText.textContent = status;
        statusDot.className = `status-dot ${state}`;
        
        console.log(`🔌 Connection status: ${status} (${state})`);
    }
    
    updateVoiceStatus(message, active) {
        const statusElement = document.getElementById('voice-status');
        const indicator = statusElement.querySelector('.status-indicator');
        const messageElement = statusElement.querySelector('.status-message');
        
        messageElement.textContent = message;
        
        if (active) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    }
    
    // NEW: Update button text and icon
    updateButtonText(text, icon) {
        const talkText = this.talkButton.querySelector('.talk-text');
        const micIcon = this.talkButton.querySelector('.mic-icon');
        
        if (talkText) talkText.textContent = text;
        if (micIcon) micIcon.textContent = icon;
    }
    
    showAudioVisualizer() {
        const visualizer = document.getElementById('audio-visualizer');
        visualizer.classList.add('active');
    }
    
    hideAudioVisualizer() {
        const visualizer = document.getElementById('audio-visualizer');
        visualizer.classList.remove('active');
    }
    
    enableUI() {
        this.talkButton.disabled = false;
        this.textInput.disabled = false;
        this.sendButton.disabled = false;
        
        // Update button text
        this.updateButtonText('Start Conversation', '🎤');
        
        console.log('✅ UI enabled');
    }
    
    disableUI() {
        this.talkButton.disabled = true;
        this.textInput.disabled = true;
        this.sendButton.disabled = true;
        
        // Update button text
        this.updateButtonText('Connecting...', '🔌');
        
        // Stop any ongoing recording
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Stop continuous mode
        if (this.isContinuousMode) {
            this.isContinuousMode = false;
            this.talkButton.classList.remove('recording');
        }
        
        console.log('🔒 UI disabled');
    }
    
    disconnect() {
        console.log('🔌 Disconnecting from WebSocket...');
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        this.isConnected = false;
        this.sessionId = null;
        
        // Stop recording if active
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Stop continuous mode
        if (this.isContinuousMode) {
            this.stopConversationMode();
        }
        
        // Update UI
        this.updateConnectionStatus('Disconnected', 'disconnected');
        this.disableUI();
    }
    
    // Utility method for testing
    testConnection() {
        if (this.websocket && this.isConnected) {
            const testMessage = {
                type: 'ping',
                timestamp: new Date().toISOString()
            };
            
            this.websocket.send(JSON.stringify(testMessage));
            console.log('📤 Test ping sent');
        } else {
            console.log('❌ Not connected - cannot send test message');
        }
    }
    
    // Debug method
    getStatus() {
        return {
            connected: this.isConnected,
            sessionId: this.sessionId,
            recording: this.isRecording,
            continuousMode: this.isContinuousMode,
            websocketState: this.websocket?.readyState,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// Export for global access
window.DialogflowClient = DialogflowClient;