# Message Handling in P2P Console Viewer

## Overview

The P2P Console Viewer now properly handles structured console messages with type preservation, supporting both inbound and outbound message flows.

## Message Structure

### P2PMessage Interface

```typescript
interface P2PMessage {
  id: string;                    // Unique message identifier
  timestamp: number;              // Unix timestamp in milliseconds
  direction: 'inbound' | 'outbound';  // Message direction
  type: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'text';  // Message type
  content: string;                // Human-readable text content
  payload?: any[];                // Optional structured data
  namespace?: string | null;      // Optional namespace for grouping
}
```

## Message Types

### Console Messages (Structured)

Messages created by `P2pMessageHelper` from the library include:

- **log**: General logging information (gray)
- **info**: Informational messages (blue)
- **warn**: Warning messages (yellow/orange)
- **error**: Error messages (red)
- **debug**: Debug information (purple)

These messages preserve:
- Original console method type
- Full payload data
- Namespace (if provided)
- Precise timestamp

### Plain Text Messages

Simple string messages without structure are treated as type `'text'`.

## Message Flow

### Inbound Messages

1. Received via P2P data channel
2. Parsed by `parseP2PMessage(data, 'inbound')`
3. Auto-detects structured vs plain messages
4. Adds to message store with proper typing
5. Displayed with type-specific styling

### Outbound Messages

1. Created in UI (or via console patching)
2. Serialized by `serializeP2PMessage(message)`
3. Sent via P2P data channel
4. Stored locally for display
5. Shows in UI with outbound styling

## Visual Indicators

### By Direction
- **Inbound**: Blue-tinted background, blue left border
- **Outbound**: Green-tinted background, green left border

### By Type
- **log**: Gray badge
- **info**: Blue badge
- **warn**: Yellow background, yellow left border
- **error**: Red background, red left border
- **debug**: Purple badge
- **text**: Gray badge

## Usage Example

### Receiving Structured Console Messages

```javascript
import { P2PSignalingClient } from 'p2p-console-viewer-lib';
import { parseP2PMessage } from '$lib/utils/p2p-client';
import { messages } from '$lib/stores/messages.store';

const client = new P2PSignalingClient('ws://localhost:3000');

client.onMessage((data) => {
  const message = parseP2PMessage(data, 'inbound');
  messages.update((msgs) => [...msgs, message]);
});
```

### Sending Messages

```javascript
const msg = {
  id: `${Date.now()}-${Math.random()}`,
  timestamp: Date.now(),
  direction: 'outbound',
  type: 'log',
  content: 'Hello from viewer!',
};

// Add to store
messages.update((msgs) => [...msgs, msg]);

// Send via P2P
connection.send(serializeP2PMessage(msg));
```

## Integration with P2pMessageHelper

The console viewer is designed to work seamlessly with `P2pMessageHelper` from the library:

```javascript
// On sender side (using P2pMessageHelper)
import { P2pMessageHelper } from 'p2p-console-viewer-lib';

const helper = new P2pMessageHelper({ namespace: 'myapp' });
const message = helper.warn('This is a warning', { code: 123 });
connection.send(P2pMessageHelper.serialize(message));

// On receiver side (console viewer)
// Automatically parsed and displayed with:
// - Type: warn
// - Content: "This is a warning {code: 123}"
// - Payload: [{ code: 123 }]
// - Namespace: "myapp"
// - Proper warning styling
```

## Features

### Payload Inspection

Structured messages with payloads show a collapsible details section:
- Shows number of payload items
- Expandable JSON view of full payload
- Syntax-highlighted display

### Namespace Filtering

Messages with namespaces display the namespace in the header, enabling:
- Visual grouping
- Future filtering by namespace
- Multi-application debugging

### Timestamp Display

All messages show human-readable timestamps:
- Format: `HH:MM:SS AM/PM`
- Hover for full date (future enhancement)
- Chronological ordering preserved

## Best Practices

1. **Use Structured Messages**: Leverage `P2pMessageHelper` for rich console logging
2. **Set Namespaces**: Use namespaces to distinguish message sources
3. **Include Payloads**: Attach relevant data objects for debugging
4. **Choose Appropriate Types**: Use correct severity levels (log/info/warn/error/debug)
5. **Preserve Types**: Always use `parseP2PMessage` and `serializeP2PMessage` helpers

## Future Enhancements

- Message filtering by type, direction, namespace
- Search functionality
- Export messages to file
- Real-time message statistics
- Custom message type definitions
