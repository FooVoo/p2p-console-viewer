export class P2pClient {
	private readonly connections = new Map<string, RTCPeerConnection>();

	addConnection(id: string, connection: RTCPeerConnection): void {
		this.connections.set(id, connection);
	}

	clear(): void {
		this.connections.clear();
	}

	isHasConnection(id: string): boolean {
		return this.connections.has(id);
	}
}
