// pcm_stream_player.js
// Browser-compatible version (no ES6 modules)

class PCMStreamPlayer {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 24000;
        this.channelCount = options.channelCount || 1;
        this.bufferDuration = options.bufferDuration || 0.1; // 100ms buffer
        
        this.audioContext = null;
        this.gainNode = null;
        this.isInitialized = false;
        this.isPlaying = false;
        
        // Audio buffer management
        this.audioQueue = [];
        this.currentTime = 0;
        this.scheduledUntil = 0;
        
        // Performance tracking
        this.stats = {
            buffersPlayed: 0,
            totalLatency: 0,
            underruns: 0
        };
        
        console.log('🔊 PCMStreamPlayer created with options:', options);
    }
    
    async initialize() {
        console.log('🚀 Initializing PCMStreamPlayer...');
        
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });
            
            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;
            this.gainNode.connect(this.audioContext.destination);
            
            console.log('🔊 Audio context created');
            console.log('📊 Target sample rate:', this.sampleRate);
            console.log('📊 Actual sample rate:', this.audioContext.sampleRate);
            
            this.isInitialized = true;
            console.log('✅ PCMStreamPlayer initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize PCMStreamPlayer:', error);
            throw error;
        }
    }
    
    async playPCMData(pcmData) {
        if (!this.isInitialized) {
            console.warn('⚠️ PCMStreamPlayer not initialized');
            return;
        }
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Convert PCM data to Float32Array if needed
            let audioData;
            if (pcmData instanceof ArrayBuffer) {
                // Assume 16-bit PCM data
                const int16Data = new Int16Array(pcmData);
                audioData = new Float32Array(int16Data.length);
                for (let i = 0; i < int16Data.length; i++) {
                    audioData[i] = int16Data[i] / 32768.0;
                }
            } else if (pcmData instanceof Int16Array) {
                audioData = new Float32Array(pcmData.length);
                for (let i = 0; i < pcmData.length; i++) {
                    audioData[i] = pcmData[i] / 32768.0;
                }
            } else if (pcmData instanceof Float32Array) {
                audioData = pcmData;
            } else {
                console.error('❌ Unsupported PCM data format:', typeof pcmData);
                return;
            }
            
            // Create audio buffer
            const audioBuffer = this.audioContext.createBuffer(
                this.channelCount,
                audioData.length,
                this.audioContext.sampleRate
            );
            
            // Fill buffer with audio data
            const channelData = audioBuffer.getChannelData(0);
            channelData.set(audioData);
            
            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.gainNode);
            
            // Schedule playback
            const currentTime = this.audioContext.currentTime;
            const startTime = Math.max(currentTime, this.scheduledUntil);
            
            source.start(startTime);
            
            // Update scheduled time
            this.scheduledUntil = startTime + audioBuffer.duration;
            
            // Track statistics
            this.stats.buffersPlayed++;
            
            // Handle source end
            source.onended = () => {
                // Clean up if needed
            };
            
            console.log(`🔊 Playing PCM data: ${audioData.length} samples, duration: ${audioBuffer.duration.toFixed(3)}s`);
            
        } catch (error) {
            console.error('❌ Failed to play PCM data:', error);
            this.stats.underruns++;
        }
    }
    
    async playAudioBuffer(audioBuffer) {
        if (!this.isInitialized) {
            console.warn('⚠️ PCMStreamPlayer not initialized');
            return;
        }
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.gainNode);
            
            // Schedule playback
            const currentTime = this.audioContext.currentTime;
            const startTime = Math.max(currentTime, this.scheduledUntil);
            
            source.start(startTime);
            
            // Update scheduled time
            this.scheduledUntil = startTime + audioBuffer.duration;
            
            console.log(`🔊 Playing audio buffer: duration ${audioBuffer.duration.toFixed(3)}s`);
            
        } catch (error) {
            console.error('❌ Failed to play audio buffer:', error);
        }
    }
    
    setVolume(volume) {
        if (this.gainNode) {
            // Clamp volume between 0 and 1
            const clampedVolume = Math.max(0, Math.min(1, volume));
            this.gainNode.gain.value = clampedVolume;
            console.log(`🔊 Volume set to: ${clampedVolume}`);
        }
    }
    
    getVolume() {
        return this.gainNode ? this.gainNode.gain.value : 0;
    }
    
    async stop() {
        console.log('🛑 Stopping PCMStreamPlayer...');
        
        try {
            // Reset scheduled time
            this.scheduledUntil = this.audioContext.currentTime;
            
            // Clear audio queue
            this.audioQueue = [];
            
            this.isPlaying = false;
            console.log('✅ PCMStreamPlayer stopped');
            
        } catch (error) {
            console.error('❌ Failed to stop PCMStreamPlayer:', error);
        }
    }
    
    dispose() {
        console.log('🗑️ Disposing PCMStreamPlayer...');
        
        try {
            // Stop playback
            this.stop();
            
            // Disconnect nodes
            if (this.gainNode) {
                this.gainNode.disconnect();
            }
            
            // Close audio context
            if (this.audioContext) {
                this.audioContext.close();
            }
            
            // Reset state
            this.isInitialized = false;
            this.isPlaying = false;
            
            console.log('✅ PCMStreamPlayer disposed');
            
        } catch (error) {
            console.error('❌ Error disposing PCMStreamPlayer:', error);
        }
    }
    
    // Utility methods
    getState() {
        return {
            isInitialized: this.isInitialized,
            isPlaying: this.isPlaying,
            sampleRate: this.sampleRate,
            channelCount: this.channelCount,
            audioContextState: this.audioContext?.state,
            currentTime: this.audioContext?.currentTime,
            scheduledUntil: this.scheduledUntil,
            volume: this.getVolume(),
            queueLength: this.audioQueue.length,
            stats: { ...this.stats }
        };
    }
    
    getLatency() {
        if (!this.audioContext) return 0;
        
        // Estimate latency based on scheduled vs current time
        const currentTime = this.audioContext.currentTime;
        const latency = this.scheduledUntil - currentTime;
        return Math.max(0, latency);
    }
    
    getStats() {
        return {
            ...this.stats,
            latency: this.getLatency(),
            audioContextState: this.audioContext?.state,
            sampleRate: this.audioContext?.sampleRate
        };
    }
    
    // Advanced features
    async createAudioBufferFromPCM(pcmData, sampleRate = null) {
        if (!this.audioContext) {
            throw new Error('AudioContext not initialized');
        }
        
        const targetSampleRate = sampleRate || this.sampleRate;
        
        // Convert PCM data to Float32Array
        let audioData;
        if (pcmData instanceof ArrayBuffer) {
            const int16Data = new Int16Array(pcmData);
            audioData = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                audioData[i] = int16Data[i] / 32768.0;
            }
        } else if (pcmData instanceof Float32Array) {
            audioData = pcmData;
        } else {
            throw new Error('Unsupported PCM data format');
        }
        
        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(
            this.channelCount,
            audioData.length,
            targetSampleRate
        );
        
        // Fill buffer
        const channelData = audioBuffer.getChannelData(0);
        channelData.set(audioData);
        
        return audioBuffer;
    }
    
    // Test methods
    async testPlayback() {
        console.log('🧪 Testing PCM playback...');
        
        try {
            // Generate test tone (440Hz sine wave)
            const duration = 1.0; // 1 second
            const frequency = 440; // A4 note
            const sampleCount = Math.floor(this.sampleRate * duration);
            
            const testData = new Float32Array(sampleCount);
            for (let i = 0; i < sampleCount; i++) {
                testData[i] = 0.3 * Math.sin(2 * Math.PI * frequency * i / this.sampleRate);
            }
            
            await this.playPCMData(testData);
            console.log('✅ Test playback started');
            
        } catch (error) {
            console.error('❌ Test playback failed:', error);
            throw error;
        }
    }
}

// Make available globally
window.PCMStreamPlayer = PCMStreamPlayer;