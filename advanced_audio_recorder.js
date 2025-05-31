// advanced_audio_recorder.js
// Browser-compatible version (no ES6 modules)

class AdvancedAudioRecorder {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 16000;
        this.channelCount = options.channelCount || 1;
        this.bufferSize = options.bufferSize || 4096;
        
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.workletNode = null;
        this.isRecording = false;
        this.isInitialized = false;
        
        this.onAudioData = null; // Callback for audio data
        
        console.log('🎤 AdvancedAudioRecorder created with options:', options);
    }
    
    async initialize() {
        console.log('🚀 Initializing AdvancedAudioRecorder...');
        
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });
            
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: this.channelCount,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            console.log('🎤 Microphone access granted');
            console.log('📊 Audio context sample rate:', this.audioContext.sampleRate);
            
            // Create source node
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            // Try to load and add audio worklet
            try {
                await this.audioContext.audioWorklet.addModule('audio_processor_worklet.js');
                console.log('✅ Audio worklet loaded');
                
                // Create worklet node
                this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
                
                // Set up worklet message handling
                this.workletNode.port.onmessage = (event) => {
                    if (event.data.type === 'audioData' && this.onAudioData) {
                        this.onAudioData(event.data.audioData);
                    }
                };
                
                // Connect nodes
                this.sourceNode.connect(this.workletNode);
                
            } catch (workletError) {
                console.warn('⚠️ AudioWorklet not available, falling back to ScriptProcessorNode');
                this.setupScriptProcessor();
            }
            
            this.isInitialized = true;
            console.log('✅ AdvancedAudioRecorder initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize AdvancedAudioRecorder:', error);
            throw error;
        }
    }
    
    setupScriptProcessor() {
        // Fallback for browsers without AudioWorklet support
        this.scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, this.channelCount, this.channelCount);
        
        this.scriptProcessor.onaudioprocess = (event) => {
            if (!this.isRecording) return;
            
            const inputBuffer = event.inputBuffer;
            const outputBuffer = event.outputBuffer;
            
            // Copy input to output (passthrough)
            for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                const inputData = inputBuffer.getChannelData(channel);
                const outputData = outputBuffer.getChannelData(channel);
                
                for (let sample = 0; sample < inputBuffer.length; sample++) {
                    outputData[sample] = inputData[sample];
                }
            }
            
            // Send audio data if callback is set
            if (this.onAudioData) {
                const audioData = inputBuffer.getChannelData(0);
                // Convert Float32Array to Int16Array for compatibility
                const int16Data = new Int16Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    int16Data[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7FFF;
                }
                this.onAudioData(int16Data.buffer);
            }
        };
        
        // Connect nodes
        this.sourceNode.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
        
        console.log('✅ ScriptProcessor fallback set up');
    }
    
    async startRecording() {
        if (!this.isInitialized) {
            throw new Error('AdvancedAudioRecorder not initialized');
        }
        
        if (this.isRecording) {
            console.warn('⚠️ Already recording');
            return;
        }
        
        console.log('🎤 Starting recording...');
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isRecording = true;
            
            // Start worklet processing
            if (this.workletNode) {
                this.workletNode.port.postMessage({ type: 'start' });
            }
            
            console.log('✅ Recording started');
            
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.isRecording = false;
            throw error;
        }
    }
    
    async stopRecording() {
        if (!this.isRecording) {
            console.warn('⚠️ Not currently recording');
            return;
        }
        
        console.log('🛑 Stopping recording...');
        
        try {
            this.isRecording = false;
            
            // Stop worklet processing
            if (this.workletNode) {
                this.workletNode.port.postMessage({ type: 'stop' });
            }
            
            console.log('✅ Recording stopped');
            
        } catch (error) {
            console.error('❌ Failed to stop recording:', error);
            throw error;
        }
    }
    
    dispose() {
        console.log('🗑️ Disposing AdvancedAudioRecorder...');
        
        try {
            // Stop recording if active
            if (this.isRecording) {
                this.stopRecording();
            }
            
            // Disconnect nodes
            if (this.sourceNode) {
                this.sourceNode.disconnect();
            }
            
            if (this.workletNode) {
                this.workletNode.disconnect();
            }
            
            if (this.scriptProcessor) {
                this.scriptProcessor.disconnect();
            }
            
            // Stop media stream
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }
            
            // Close audio context
            if (this.audioContext) {
                this.audioContext.close();
            }
            
            // Reset state
            this.isInitialized = false;
            this.isRecording = false;
            
            console.log('✅ AdvancedAudioRecorder disposed');
            
        } catch (error) {
            console.error('❌ Error disposing AdvancedAudioRecorder:', error);
        }
    }
    
    // Utility methods
    getState() {
        return {
            isInitialized: this.isInitialized,
            isRecording: this.isRecording,
            sampleRate: this.sampleRate,
            channelCount: this.channelCount,
            audioContextState: this.audioContext?.state,
            hasMediaStream: !!this.mediaStream,
            hasWorklet: !!this.workletNode,
            hasScriptProcessor: !!this.scriptProcessor
        };
    }
    
    async testMicrophone() {
        console.log('🧪 Testing microphone access...');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Microphone test successful');
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('❌ Microphone test failed:', error);
            return false;
        }
    }
}

// Make available globally
window.AdvancedAudioRecorder = AdvancedAudioRecorder;