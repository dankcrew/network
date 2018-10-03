const events = Object.freeze({
    PEER_DISCOVERED: 'streamr:peer:discovery',
    PEER_CONNECTED: 'streamr:peer:connect',
    PEER_DISCONNECTED: 'streamr:peer:disconnect',
    MESSAGE_SENT: 'streamr:message-sent',
    MESSAGE_RECEIVED: 'streamr:message-received'
})

class Endpoint {
    implement(implementor) {
        if (typeof implementor.send !== 'function') {
            throw new Error('send() method not found in class implementing Endpoint')
        }
        if (typeof implementor.connect !== 'function') {
            throw new Error('connect() method not found in class implementing Endpoint')
        }
        if (typeof implementor.stop !== 'function') {
            throw new Error('stop() method not found in class implementing Endpoint')
        }
    }
}

Endpoint.events = events

module.exports = Endpoint