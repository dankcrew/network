const { v4: uuidv4 } = require('uuid')
const Protocol = require('streamr-client-protocol')

const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const { PeerInfo } = require('./connection/PeerInfo')
const Tracker = require('./logic/Tracker')
const RtcSignaller = require('./logic/RtcSignaller')
const NetworkNode = require('./NetworkNode')
const { startEndpoint } = require('./connection/WsEndpoint')
const { WebRtcEndpoint } = require('./connection/WebRtcEndpoint')

const STUN_URLS = ['stun:stun.l.google.com:19302'] // TODO: make configurable

function startTracker(host, port, id = uuidv4(), maxNeighborsPerNode = 4, advertisedWsUrl = null, name, location) {
    const peerInfo = PeerInfo.newTracker(id, name, location)
    return startEndpoint(host, port, peerInfo, advertisedWsUrl).then((endpoint) => {
        const opts = {
            peerInfo,
            protocols: {
                trackerServer: new TrackerServer(endpoint)
            },
            maxNeighborsPerNode
        }
        return new Tracker(opts)
    })
}

function startNetworkNode(host, port, id = uuidv4(), storages = [], advertisedWsUrl = null, name, location) {
    const peerInfo = PeerInfo.newNode(id, name, location)
    return startEndpoint(host, port, peerInfo, advertisedWsUrl).then((endpoint) => {
        const trackerNode = new TrackerNode(endpoint)
        const webRtcSignaller = new RtcSignaller(peerInfo, trackerNode)
        const nodeToNode = new NodeToNode(new WebRtcEndpoint(id, STUN_URLS, webRtcSignaller))
        const opts = {
            peerInfo,
            protocols: {
                trackerNode,
                nodeToNode
            },
            storages
        }
        return new NetworkNode(opts)
    })
}

function startStorageNode(host, port, id = uuidv4(), storages = [], advertisedWsUrl = null, name, location) {
    const peerInfo = PeerInfo.newStorage(id, name, location)
    return startEndpoint(host, port, peerInfo, advertisedWsUrl).then((endpoint) => {
        const trackerNode = new TrackerNode(endpoint)
        const webRtcSignaller = new RtcSignaller(peerInfo, trackerNode)
        const nodeToNode = new NodeToNode(new WebRtcEndpoint(id, STUN_URLS, webRtcSignaller))
        const opts = {
            peerInfo,
            protocols: {
                trackerNode,
                nodeToNode
            },
            storages
        }
        return new NetworkNode(opts)
    })
}

module.exports = {
    startTracker,
    startNetworkNode,
    startStorageNode,
    Protocol,
}
