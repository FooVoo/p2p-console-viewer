export function setupPeerA(): Promise<any>;
export function setupPeerB(offer: any): Promise<{
    peerB: any;
    answer: any;
}>;
export class P2PSignalingClient {
    constructor(signalingServerUrl: any);
    ws: any;
    p2p: any;
    remotePeerId: any;
    setupSignaling(): void;
    setupP2P(): void;
    handleSignalingMessage(data: any): void;
    connect(signalingServer: any): void;
    initiateP2P(remotePeerId: any): any;
    sendMessage(message: any): any;
    disconnect(): void;
}
