class P2PSignalingClient {
    constructor(signalingServerUrl) {
        this.ws = new WebSocketConnector(signalingServerUrl);
        this.p2p = new P2PConnection();
        this.remotePeerId = null;

        this.setupSignaling();
        this.setupP2P();
    }

    setupSignaling() {
        // Handle signaling messages from server
        this.ws.onMessage((message) => {
            try {
                const data = JSON.parse(message);
                this.handleSignalingMessage(data);
            } catch (e) {
                console.error('Failed to parse signaling message:', e);
            }
        });

        this.ws.onOpen(() => {
            console.log('Signaling server connected');
        });
    }

    setupP2P() {
        // Send ICE candidates through signaling server
        this.p2p.onIceCandidate((candidate) => {
            this.ws.send({
                type: 'ice-candidate',
                to: this.remotePeerId,
                candidate: candidate
            });
        });

        // Send offer through signaling server
        this.p2p.onOffer((offer) => {
            this.ws.send({
                type: 'offer',
                to: this.remotePeerId,
                offer: offer
            });
        });

        // Send answer through signaling server
        this.p2p.onAnswer((answer) => {
            this.ws.send({
                type: 'answer',
                to: this.remotePeerId,
                answer: answer
            });
        });

        // Handle P2P messages
        this.p2p.onMessage((message) => {
            console.log('P2P message received:', message);
            // Handle application-level messages
        });

        // Handle P2P connection established
        this.p2p.onConnected(() => {
            console.log('P2P connection established!');
            // Now we can communicate directly without the signaling server
        });
    }

    handleSignalingMessage(data) {
        switch (data.type) {
            case 'offer':
                this.remotePeerId = data.from;
                this.p2p.receiveOffer(data.offer);
                break;

            case 'answer':
                this.p2p.receiveAnswer(data.answer);
                break;

            case 'ice-candidate':
                this.p2p.addIceCandidate(data.candidate);
                break;

            default:
                console.log('Unknown signaling message:', data);
        }
    }

    connect(signalingServer) {
        this.ws.connect();
    }

    initiateP2P(remotePeerId) {
        this.remotePeerId = remotePeerId;
        return this.p2p.initiate();
    }

    sendMessage(message) {
        return this.p2p.send(message);
    }

    disconnect() {
        this.p2p.close();
        this.ws.disconnect();
    }
}

export default {P2PSignalingClient};
