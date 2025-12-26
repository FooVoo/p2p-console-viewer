#### Chart 1 — Offer creation (Initiator → Receiver)
- The Initiator calls `createPeerConnection()` and creates a data channel with `createDataChannel('dataChannel')`.
- The Initiator generates an SDP offer with `createOffer()` and applies it locally with `setLocalDescription(offer)`.
- The offer is emitted via the project's signaling handlers (shown as `onOfferHandlers`) and transmitted to the Receiver.
- The Receiver receives the offer and calls `setRemoteDescription(offer)` so its `RTCPeerConnection` knows the Initiator's parameters.

```mermaid
flowchart LR
    subgraph Initiator
        I_PC["createPeerConnection()"]
        I_DC["createDataChannel('dataChannel')"]
        I_SetLocalOffer["createOffer()\nsetLocalDescription(offer)"]
        I_EmitOffer[emit offer via onOfferHandlers]
        I_ReceiveAnswer["receiveAnswer(answer)\nsetRemoteDescription(answer)"]
    end

    subgraph Signaling
        OfferTrans([Offer via signaling])
    end

    subgraph Receiver
        R_PC["createPeerConnection()"]
        R_SetRemote["setRemoteDescription(offer)"]
    end

    %% Offer/Answer flow (Initiator -> Receiver)
    I_PC --> I_DC --> I_SetLocalOffer --> I_EmitOffer --> OfferTrans --> R_SetRemote
```

#### Chart 2 — Answer creation (Receiver → Initiator)
- The Receiver creates its `RTCPeerConnection()` and sets the incoming offer as its remote description (`setRemoteDescription(offer)`).
- The Receiver creates an SDP answer via `createAnswer()` and applies it with `setLocalDescription(answer)`.
- The answer is emitted through signaling (`onAnswerHandlers`) back to the Initiator.
- The Initiator receives the answer and calls `setRemoteDescription(answer)` to finalize the SDP handshake.

```mermaid
flowchart LR
    subgraph Initiator
        I_PC["createPeerConnection()"]
        I_ReceiveAnswer["receiveAnswer(answer)\nsetRemoteDescription(answer)"]
    end

    subgraph Signaling
        AnswerTrans([Answer via signaling])
    end

    subgraph Receiver
        R_PC["createPeerConnection()"]
        R_SetLocalAnswer["createAnswer()\nsetLocalDescription(answer)"]
        R_EmitAnswer[emit answer via onAnswerHandlers]
        R_SetRemote["setRemoteDescription(offer)"]
    end

    %% Offer/Answer flow (Receiver -> Initiator)
    R_PC --> R_SetRemote --> R_SetLocalAnswer --> R_EmitAnswer --> AnswerTrans --> I_ReceiveAnswer

```

#### Chart 3 — ICE candidate exchange
- Both peers listen for `onicecandidate` events from their `RTCPeerConnection`.
- When a candidate is discovered it is sent over the signaling channel (`ICE candidates via signaling`) to the remote peer.
- Each peer receives candidates via signaling and adds them to their `RTCPeerConnection` so ICE can establish the best transport path.

```mermaid
flowchart LR
    subgraph Signaling
        ICE_Signaling([ICE candidates via signaling])
    end

    subgraph Initiator
        I_PC["createPeerConnection()"]
    end

    subgraph Receiver
        R_PC["createPeerConnection()"]
    end

    %% ICE exchange (both directions)
    I_PC ---|onicecandidate| ICE_Signaling
    R_PC ---|onicecandidate| ICE_Signaling
    ICE_Signaling -->|deliver candidate| I_PC
    ICE_Signaling -->|deliver candidate| R_PC
```

#### Chart 4 — Data channel setup & messaging
- Initiator-created `dataChannel` triggers local setup (`setupDataChannel()`).
- On the Receiver side, `ondatachannel` is fired when the remote data channel arrives; the Receiver runs its own `setupDataChannel()`.
- After setup, both sides see an `onopen` event when the data channel is ready.
- Either side can `send(data)` and the opposite side receives it via `onmessage`, which is forwarded to app-level `onMessageHandlers`.

```mermaid
flowchart LR
    subgraph Initiator
        I_PC["createPeerConnection()"]
        I_DC["createDataChannel('dataChannel')"]
        I_DataSetup["setupDataChannel()"]
        I_Open[onopen]
        I_OnMessage[remote onmessage -> onMessageHandlers]
    end

    subgraph Receiver
        R_PC["createPeerConnection()"]
        R_OnDataChannel["ondatachannel -> setupDataChannel()"]
        R_DataSetup["setupDataChannel()"]
        R_Open[onopen]
        R_OnMessage[remote onmessage -> onMessageHandlers]
    end

    %% Data channel setup & messaging
    R_PC --> R_OnDataChannel --> R_DataSetup
    I_DC --> I_DataSetup
    I_DataSetup --> I_Open
    R_DataSetup --> R_Open
    I_DataSetup -->|"send(data)"| R_OnMessage
    R_DataSetup -->|"send(data)"| I_OnMessage
```

#### Chart 5 — Connection state & cleanup
- Each `RTCPeerConnection` reports lifecycle changes via `onconnectionstatechange`.
- When the state becomes `connected`, the corresponding `onConnectedHandlers` are invoked.
- If the state becomes `disconnected`, `failed`, or `closed`, `onDisconnectedHandlers` run to handle cleanup.
- Calling `close()` should close both the `dataChannel` and the `peerConnection` to free resources and terminate the session.

```mermaid
flowchart LR
    subgraph Initiator
        I_PC["createPeerConnection()"]
        I_Close["close() -> dataChannel.close(), peerConnection.close()"]
    end

    subgraph Receiver
        R_PC["createPeerConnection()"]
        R_Close["close() -> dataChannel.close(), peerConnection.close()"]
    end

    ConnStateI[onconnectionstatechange]
    ConnStateR[onconnectionstatechange]
    I_OnConnected[onConnectedHandlers]
    R_OnConnected[onConnectedHandlers]
    I_OnDisconnected[onDisconnectedHandlers]
    R_OnDisconnected[onDisconnectedHandlers]

    %% Connection state & cleanup
    I_PC --> ConnStateI
    R_PC --> ConnStateR
    ConnStateI -->|connected| I_OnConnected
    ConnStateR -->|connected| R_OnConnected
    ConnStateI -->|disconnected\/failed\/closed| I_OnDisconnected
    ConnStateR -->|disconnected\/failed\/closed| R_OnDisconnected

    I_PC --> I_Close
    R_PC --> R_Close
```
