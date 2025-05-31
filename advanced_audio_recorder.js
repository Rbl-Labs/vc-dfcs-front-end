// advanced_audio_recorder.js
// Modified to use AudioWorklet for resampling.

class AdvancedAudioRecorder {
    constructor(options = {}) {
        this.requestedSampleRate = options.sampleRate || 16000; // Target output sample rate
        this.channelCount = options.channelCount || 1;
        // Capture bufferSize from options if provided, for the worklet
        this.workletBufferSize = options.bufferSize || 2048; // Default Int16 samples for worklet buffer
        
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.gainNode = null; 
        this.audioWorkletNode = null; // Using AudioWorkletNode
        this.isRecording = false;
        this.isInitialized = false;
        
        this.onAudioData = options.onAudioData || null;
        
        console.log('🎤 AdvancedAudioRecorder created (AudioWorklet Mode) with options:', JSON.stringify(options));
    }
    
    async initialize() {
        console.log('🚀 ADV_REC (AW): Initializing...');
        try {
            console.log('🚀 ADV_REC (AW): Requesting media stream...');
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: { exact: 1 }, // Force mono
                    channelCountMode: "explicit",
                    channelInterpretation: "speakers",
                    sampleRate: { ideal: this.requestedSampleRate },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            console.log('🎤 ADV_REC (AW): Microphone access granted, requested SR:', this.requestedSampleRate, 'autoGainControl: true');

            const mediaStreamAudioTrack = this.mediaStream.getAudioTracks()[0];
            const mediaStreamSettings = mediaStreamAudioTrack.getSettings();
            // Log the actual sample rate from the stream settings if available
            if (mediaStreamSettings.sampleRate) {
                console.log(`📊 ADV_REC (AW): MediaStream actual SR from settings: ${mediaStreamSettings.sampleRate} Hz.`);
            }

            console.log('📊 ADV_REC (AW): Creating AudioContext, requesting SR:', this.requestedSampleRate);
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: this.requestedSampleRate // Attempt to set AudioContext sample rate
                });
            } catch (e) {
                console.warn(`⚠️ ADV_REC (AW): Could not create AudioContext with requested SR ${this.requestedSampleRate}. Falling back to default. Error: ${e.message}`);
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            console.log(`📊 ADV_REC (AW): AudioContext actual SR: ${this.audioContext.sampleRate} Hz.`);
            
            // This will be the true input sample rate to the worklet.
            // If context is 16k, and stream is 16k, this is 16k.
            // If context is 48k (fallback) and stream is 48k, this is 48k, and worklet will resample.
            // If context is 16k but stream is 48k (unlikely but possible), browser resamples to context rate.
            const workletInputSampleRate = this.audioContext.sampleRate; 
            console.log(`📊 ADV_REC (AW): Effective input SR to Worklet will be AudioContext SR: ${workletInputSampleRate} Hz.`);

            console.log('📊 ADV_REC (AW): Creating MediaStreamSourceNode...');
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            console.log('🛠️ ADV_REC (AW): Creating GainNode...');
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 5; // Moderate gain of 5
            console.log(`🔊 ADV_REC (AW): GainNode created with gain value: ${this.gainNode.gain.value}`);
            
            console.log('🛠️ ADV_REC (AW): Adding AudioWorklet module: audio_processor_worklet.js');
            try {
                await this.audioContext.audioWorklet.addModule('audio_processor_worklet.js');
                console.log('✅ ADV_REC (AW): AudioWorklet module added.');
            } catch (e) {
                console.error('❌ ADV_REC (AW): Failed to add AudioWorklet module. Ensure audio_processor_worklet.js is accessible.', e);
                throw e;
            }
            
            console.log(`🛠️ ADV_REC (AW): Creating AudioWorkletNode ('audio-processor'). Worklet Input SR: ${workletInputSampleRate}, Worklet Output SR: ${this.requestedSampleRate}`);
            console.log(`🛠️ ADV_REC (AW): Creating AudioWorkletNode ('audio-processor'). Worklet Input SR: ${workletInputSampleRate}, Worklet Output SR: ${this.requestedSampleRate}, Worklet BufferSize: ${this.workletBufferSize}`);
            console.log(`📊 ADV_REC (AW): Sample rate verification before worklet creation:`, {
                requested: this.requestedSampleRate,
                audioContextActual: this.audioContext.sampleRate,
                workletInputWillBe: workletInputSampleRate,
                streamActual: mediaStreamSettings.sampleRate || 'Unknown',
                targetOutput: 16000,
                channelCount: this.channelCount
            });
            
            this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
                channelCount: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'speakers',
                numberOfInputs: 1,
                numberOfOutputs: 1,
                processorOptions: {
                    inputSampleRate: workletInputSampleRate, 
                    targetSampleRate: this.requestedSampleRate,
                    bufferSize: this.workletBufferSize
                }
            });

            // Force mono on the source node too
            this.sourceNode.channelCount = 1;
            this.sourceNode.channelCountMode = 'explicit';
            this.sourceNode.channelInterpretation = 'speakers';

            // Log actual worklet options
            console.log('📊 ADV_REC (AW): Worklet node created with options:', {
                channelCount: this.audioWorkletNode.channelCount,
                channelCountMode: this.audioWorkletNode.channelCountMode,
                channelInterpretation: this.audioWorkletNode.channelInterpretation,
                numberOfInputs: this.audioWorkletNode.numberOfInputs,
                numberOfOutputs: this.audioWorkletNode.numberOfOutputs
            });
            
            this.audioWorkletNode.port.onmessage = (event) => {
                if (this.isRecording && this.onAudioData) {
                    // Pass audio data to onAudioData callback
                    if (event.data.type === 'audioData' && event.data.audioData && event.data.audioData.length > 0) {
                        this.onAudioData(event.data.audioData);
                    }
                }
            };
            
            this.sourceNode.connect(this.gainNode); // source -> gain
            this.gainNode.connect(this.audioWorkletNode); // gain -> worklet
            // Do NOT connect audioWorkletNode to destination if its only job is to postMessage data
            // unless it's also designed to pass audio through.
            // If direct monitoring of raw mic input is ever needed (and causes feedback with ScriptProcessor),
            // this setup avoids that issue by default.
            console.log('✅ ADV_REC (AW): AudioWorkletNode connected.');
            
            this.isInitialized = true;
            console.log('✅ ADV_REC (AW): Initialized successfully.');
        } catch (error) {
            console.error('❌ ADV_REC (AW): Failed to initialize:', error.name, error.message, error.stack);
            this.isInitialized = false; 
            throw error;
        }
    }
    
    async startRecording() {
        if (!this.isInitialized) {
            console.error('❌ ADV_REC (AW): Not initialized. Cannot start recording.');
            throw new Error('AdvancedAudioRecorder not initialized.');
        }
        if (this.isRecording) { 
            console.warn('⚠️ ADV_REC (AW): Already recording'); 
            return; 
        }
        
        console.log('🎤 ADV_REC (AW): Starting recording...');
        // Added debug logs from Step 4
        if (this.audioContext) {
            console.log(`🎤 ADV_REC (AW) Debug: AudioContext state: ${this.audioContext.state}, Sample Rate: ${this.audioContext.sampleRate}`);
        } else {
            console.error('🎤 ADV_REC (AW) Debug: AudioContext is null before starting recording attempt.');
        }
        if (this.mediaStream) {
            console.log(`🎤 ADV_REC (AW) Debug: MediaStream active: ${this.mediaStream.active}, Track enabled: ${this.mediaStream.getAudioTracks()[0]?.enabled}`);
        } else {
            console.error('🎤 ADV_REC (AW) Debug: MediaStream is null before starting recording attempt.');
        }
        
        try {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                console.log('🎤 ADV_REC (AW): Resuming AudioContext...');
                await this.audioContext.resume();
                console.log('🎤 ADV_REC (AW): AudioContext resumed.');
            }
            
            // Test the audio chain
            if (this.sourceNode) {
                console.log(`🎤 ADV_REC (AW) Debug: Source node channel count: ${this.sourceNode.channelCount}`);
            } else {
                console.warn('🎤 ADV_REC (AW) Debug: SourceNode is null at startRecording, cannot check channel count.');
            }
            
            this.isRecording = true;
            if (this.audioWorkletNode) {
                this.audioWorkletNode.port.postMessage({ type: 'start' });
            }
            console.log('✅ ADV_REC (AW): Recording state set to true, worklet started.');
        } catch (error) {
            console.error('❌ ADV_REC (AW): Failed to start recording:', error.name, error.message, error.stack);
            this.isRecording = false; throw error;
        }
    }
    
    async stopRecording() {
        if (!this.isRecording) { return; }
        console.log('🛑 ADV_REC (AW): Stopping recording...');
        try {
            this.isRecording = false; 
            if (this.audioWorkletNode) {
                this.audioWorkletNode.port.postMessage({ type: 'stop' });
            }
            console.log('✅ ADV_REC (AW): Recording state set to false, worklet stopped.');
        } catch (error) {
            console.error('❌ ADV_REC (AW): Failed to stop recording:', error.name, error.message, error.stack);
            throw error; 
        }
    }
    
    dispose() {
        console.log('🗑️ ADV_REC (AW): Disposing...');
        try {
            if (this.isRecording) { this.stopRecording(); } 
            if (this.sourceNode) { this.sourceNode.disconnect(); this.sourceNode = null; }
            if (this.gainNode) { this.gainNode.disconnect(); this.gainNode = null; }
            if (this.audioWorkletNode) { 
                this.audioWorkletNode.port.onmessage = null; // Clear handler
                this.audioWorkletNode.disconnect(); 
                this.audioWorkletNode = null; 
            }
            if (this.mediaStream) { this.mediaStream.getTracks().forEach(track => track.stop()); this.mediaStream = null; }
            if (this.audioContext && this.audioContext.state !== 'closed') { 
                this.audioContext.close().then(() => console.log('✅ ADV_REC (AW): AudioContext closed.'));
                this.audioContext = null;
            }
            this.isInitialized = false; this.isRecording = false;
            console.log('✅ ADV_REC (AW): Disposed.');
        } catch (error) { console.error('❌ ADV_REC (AW): Error disposing:', error.name, error.message, error.stack); }
    }

    getState() {
        return {
            isInitialized: this.isInitialized, isRecording: this.isRecording,
            requestedSampleRate: this.requestedSampleRate, 
            inputSampleRateToWorklet: this.audioWorkletNode?.processorOptions?.inputSampleRate, // This might not be directly accessible
            actualAudioContextSR: this.audioContext?.sampleRate,
            channelCount: this.channelCount,
            audioContextState: this.audioContext?.state, hasMediaStream: !!this.mediaStream,
        };
    }

    async testMicrophone() {
        console.log('🧪 ADV_REC (AW): Testing microphone access...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ ADV_REC (AW): Microphone test successful');
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) { console.error('❌ ADV_REC (AW): Microphone test failed:', error); return false; }
    }
}
window.AdvancedAudioRecorder = AdvancedAudioRecorder;
