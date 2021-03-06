import { MetricsContext, startTracker } from '../../src/composition'
import { startEndpoint } from '../../src/connection/WsEndpoint'
import { TrackerNode } from '../../src/protocol/TrackerNode'
import { Tracker, Event as TrackerEvent } from '../../src/logic/Tracker'
import { PeerInfo } from '../../src/connection/PeerInfo'
import { waitForCondition, waitForEvent } from 'streamr-test-utils'
import { Event as EndpointEvent, WebRtcEndpoint } from '../../src/connection/WebRtcEndpoint'
import { RtcSignaller } from '../../src/logic/RtcSignaller'

describe('WebRtcEndpoint', () => {
    let tracker: Tracker
    let trackerNode1: TrackerNode
    let trackerNode2: TrackerNode
    let endpoint1: WebRtcEndpoint
    let endpoint2: WebRtcEndpoint

    beforeEach(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 28700,
            id: 'tracker'
        })

        const ep1 = await startEndpoint('127.0.0.1', 28701, PeerInfo.newNode('node-1'), null, new MetricsContext(''))
        const ep2 = await startEndpoint('127.0.0.1', 28702, PeerInfo.newNode('node-2'), null, new MetricsContext(''))
        trackerNode1 = new TrackerNode(ep1)
        trackerNode2 = new TrackerNode(ep2)

        trackerNode1.connectToTracker(tracker.getAddress())
        await waitForEvent(tracker, TrackerEvent.NODE_CONNECTED)
        trackerNode2.connectToTracker(tracker.getAddress())
        await waitForEvent(tracker, TrackerEvent.NODE_CONNECTED)

        const peerInfo1 = PeerInfo.newNode('node-1')
        const peerInfo2 = PeerInfo.newNode('node-2')
        endpoint1 = new WebRtcEndpoint('node-1', ['stun:stun.l.google.com:19302'],
            new RtcSignaller(peerInfo1, trackerNode1), new MetricsContext(''))
        endpoint2 = new WebRtcEndpoint('node-2', ['stun:stun.l.google.com:19302'],
            new RtcSignaller(peerInfo2, trackerNode2), new MetricsContext(''))
    })

    afterEach(async () => {
        await Promise.allSettled([
            tracker.stop(),
            trackerNode1.stop(),
            trackerNode2.stop(),
            endpoint1.stop(),
            endpoint2.stop()
        ])
    })

    it('connection between nodes is established when both nodes invoke connect()', async () => {
        endpoint1.connect('node-2', 'tracker', true).catch(() => null)
        endpoint2.connect('node-1', 'tracker', false).catch(() => null)

        await Promise.all([
            waitForEvent(endpoint1, EndpointEvent.PEER_CONNECTED),
            waitForEvent(endpoint2, EndpointEvent.PEER_CONNECTED)
        ])

        let ep1NumOfReceivedMessages = 0
        let ep2NumOfReceivedMessages = 0

        endpoint1.on(EndpointEvent.MESSAGE_RECEIVED, () => {
            ep1NumOfReceivedMessages += 1
        })
        endpoint2.on(EndpointEvent.MESSAGE_RECEIVED, () => {
            ep2NumOfReceivedMessages += 1
        })

        const sendFrom1To2 = () => {
            endpoint1.send('node-2', JSON.stringify({
                hello: 'world'
            }))
        }
        const sendFrom2To1 = () => {
            endpoint2.send('node-1', JSON.stringify({
                hello: 'world'
            }))
        }

        for (let i = 0; i < 10; ++i) {
            setTimeout(sendFrom1To2, 10 * i)
            setTimeout(sendFrom2To1, 10 * i + 5)
        }

        await waitForCondition(() => ep1NumOfReceivedMessages > 9)
        await waitForCondition(() => ep2NumOfReceivedMessages > 9)
    })

    it('connection between nodes is established when only one node invokes connect()', async () => {
        endpoint1.connect('node-2', 'tracker').catch(() => null)

        await Promise.all([
            waitForEvent(endpoint1, EndpointEvent.PEER_CONNECTED),
            waitForEvent(endpoint2, EndpointEvent.PEER_CONNECTED)
        ])

        let ep1NumOfReceivedMessages = 0
        let ep2NumOfReceivedMessages = 0

        endpoint1.on(EndpointEvent.MESSAGE_RECEIVED, () => {
            ep1NumOfReceivedMessages += 1
        })
        endpoint2.on(EndpointEvent.MESSAGE_RECEIVED, () => {
            ep2NumOfReceivedMessages += 1
        })

        const sendFrom1To2 = () => {
            endpoint1.send('node-2', JSON.stringify({
                hello: 'world'
            }))
        }
        const sendFrom2To1 = () => {
            endpoint2.send('node-1', JSON.stringify({
                hello: 'world'
            }))
        }

        for (let i = 0; i < 10; ++i) {
            setTimeout(sendFrom1To2, 10 * i)
            setTimeout(sendFrom2To1, 10 * i + 5)
        }

        await waitForCondition(() => ep1NumOfReceivedMessages === 10)
        await waitForCondition(() => ep2NumOfReceivedMessages === 10)
    })

    it('cannot send too large of a payload', (done) => {
        const payload = new Array(1024 * 1024).fill('X').join('')
        endpoint1.connect('node-2', 'tracker')
        endpoint1.send('node-2', payload).catch((err) => {
            expect(err.message).toMatch(/Dropping message due to size 1048576 exceeding the limit of \d+/)
            done()
        })
    })
})
