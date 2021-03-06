import { Tracker } from '../../src/logic/Tracker'
import { NetworkNode } from '../../src/NetworkNode'
import { MessageLayer, ControlLayer } from 'streamr-client-protocol'
import { waitForStreamToEnd, waitForEvent, toReadableStream } from 'streamr-test-utils'

import { startNetworkNode, startStorageNode, startTracker } from '../../src/composition'
import { Event as NodeEvent } from '../../src/logic/Node'
import { StreamIdAndPartition } from '../../src/identifiers'
import { MockStorageConfig } from './MockStorageConfig'

const { ControlMessage } = ControlLayer
const { StreamMessage, MessageID, MessageRef } = MessageLayer

const typesOfStreamItems = async (stream: any) => {
    const arr = await waitForStreamToEnd(stream)
    return arr.map((msg: any) => msg.type)
}

/**
 * This test verifies that requesting a resend of stream S from a node that is
 * not subscribed to S (is uninvolved) works as expected. That is, the resend
 * request will be fulfilled via L3 by delegating & proxying through a storage
 * node.
 */
describe('request resend from uninvolved node', () => {
    let tracker: Tracker
    let uninvolvedNode: NetworkNode
    let involvedNode: NetworkNode
    let storageNode: NetworkNode

    beforeAll(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 28640,
            id: 'tracker'
        })
        uninvolvedNode = await startNetworkNode({
            host: '127.0.0.1',
            port: 28641,
            id: 'uninvolvedNode',
            trackers: [tracker.getAddress()],
            storages: [{
                store: () => {},
                requestLast: () => toReadableStream(),
                requestFrom: () => toReadableStream(),
                requestRange: () => toReadableStream()
            }]
        })
        involvedNode = await startNetworkNode({
            host: '127.0.0.1',
            port: 28642,
            id: 'involvedNode',
            trackers: [tracker.getAddress()],
            storages: [{
                store: () => {},
                requestLast: () => toReadableStream(),
                requestFrom: () => toReadableStream(),
                requestRange: () => toReadableStream()
            }]
        })
        const mockRequest = () => toReadableStream(
            new StreamMessage({
                messageId: new MessageID('streamId', 0, 756, 0, 'publisherId', 'msgChainId'),
                prevMsgRef: new MessageRef(666, 50),
                content: {},
            }),
            new StreamMessage({
                messageId: new MessageID('streamId', 0, 800, 0, 'publisherId', 'msgChainId'),
                prevMsgRef: new MessageRef(756, 0),
                content: {},
            })
        )
        const storageConfig = new MockStorageConfig()
        storageConfig.addStream(new StreamIdAndPartition('streamId', 0))
        storageNode = await startStorageNode({
            host: '127.0.0.1',
            port: 28643,
            id: 'storageNode',
            trackers: [tracker.getAddress()],
            storages: [{
                store: () => {},
                requestLast: mockRequest,
                requestFrom: mockRequest,
                requestRange: mockRequest
            }],
            storageConfig
        })

        involvedNode.subscribe('streamId', 0)

        uninvolvedNode.start()
        involvedNode.start()
        storageNode.start()

        await Promise.all([
            waitForEvent(involvedNode, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(storageNode, NodeEvent.NODE_SUBSCRIBED)
        ])
    })

    afterAll(async () => {
        await uninvolvedNode.stop()
        await involvedNode.stop()
        await storageNode.stop()
        await tracker.stop()
    })

    test('requesting resend from uninvolved node is fulfilled using l3', async () => {
        const stream = uninvolvedNode.requestResendLast('streamId', 0, 'requestId', 10)
        const events = await typesOfStreamItems(stream)

        expect(events).toEqual([
            ControlMessage.TYPES.UnicastMessage,
            ControlMessage.TYPES.UnicastMessage,
        ])
        // @ts-expect-error private field
        expect(uninvolvedNode.streams.getStreamsAsKeys()).toEqual([]) // sanity check
    })
})
