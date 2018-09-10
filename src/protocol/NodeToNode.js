const EventEmitter = require('events').EventEmitter
const {
    isTracker,
    getAddress,
    getStreams
} = require('../util')
const encoder = require('../helpers/MessageEncoder')
const debug = require('debug')('streamr:node-node')

module.exports = class TrackerServer extends EventEmitter {
    constructor(connection) {
        super()

        this.connection = connection

        this.on('streamr:node-node:connect', (peers) => this.connectNodes(peers))
    }

    connectNodes(peers) {
        peers.forEach((peer) => {
            debug('connecting to new node %s', peer)
            this.connection.connect(peer)
        })
    }
}