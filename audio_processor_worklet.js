// audio_processor_worklet.js
// AudioWorklet processor for real-time audio processing

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        this.isProcessing = false;
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        
        // Listen for messages from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'start') {
                this.isProcessing = true;
                console.log('🎤 Audio processor started');
            } else if (event.data.type === 'stop') {
                this.isProcessing = false;
                console.log('🛑 Audio processor stopped');
            }
        };
        
        console.log('🎵 AudioProcessor worklet initialized');
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        // Process if we have input and are actively processing
        if (input && input.length > 0 && this.isProcessing) {
            const inputChannel = input[0];
            
            // Copy input to output (passthrough)
            if (output && output.length > 0) {
                const outputChannel = output[0];
                for (let i = 0; i < inputChannel.length; i++) {
                    outputChannel[i] = inputChannel[i];
                }
            }
            
            // Buffer audio data for streaming
            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex] = inputChannel[i];
                this.bufferIndex++;
                
                // Send buffer when full
                if (this.bufferIndex >= this.bufferSize) {
                    this.sendAudioData();
                    this.bufferIndex = 0;
                }
            }
        }
        
        // Keep processor alive
        return true;
    }
    
    sendAudioData() {
        // Convert Float32Array to Int16Array for network transmission
        const int16Buffer = new Int16Array(this.bufferSize);
        for (let i = 0; i < this.bufferSize; i++) {
            // Clamp and convert to 16-bit PCM
            const sample = Math.max(-1, Math.min(1, this.buffer[i]));
            int16Buffer[i] = sample * 0x7FFF;
        }
        
        // Send to main thread
        this.port.postMessage({
            type: 'audioData',
            audioData: int16Buffer.buffer
        });
    }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor);