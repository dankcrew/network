import { ControlLayer, MessageLayer } from 'streamr-client-protocol'
import { toReadableStream } from 'streamr-test-utils'

import { proxyRequestStream } from '../../src/resend/proxyRequestStream'

const { ResendResponseResending, ResendResponseNoResend, ResendResponseResent, UnicastMessage, ResendLastRequest } = ControlLayer
const { StreamMessage, MessageID } = MessageLayer

describe('proxyRequestStream', () => {
    let sendFn: any
    let request: any

    beforeEach(() => {
        sendFn = jest.fn()
        request = new ResendLastRequest({
            requestId: 'requestId',
            streamId: 'streamId',
            streamPartition: 0,
            numberLast: 10,
            sessionToken: 'sessionToken',
        })
    })

    it('empty requestStream causes only NoResend to be sent', (done) => {
        const stream = toReadableStream()
        proxyRequestStream(sendFn, request, stream)
        stream.on('end', () => {
            expect(sendFn.mock.calls).toEqual([
                [new ResendResponseNoResend({
                    requestId: 'requestId',
                    streamId: 'streamId',
                    streamPartition: 0,
                })]
            ])
            done()
        })
    })

    it('requestStream with messages causes Resending, Unicast(s), and Resent to be sent', (done) => {
        const firstMessage = new StreamMessage({
            messageId: new MessageID('streamId', 0, 10000000, 0, 'publisherId', 'msgChainId'),
            content: {
                hello: 'world'
            },
        })
        const secondMessage = new StreamMessage({
            messageId: new MessageID('streamId', 0, 20000000, 0, 'publisherId', 'msgChainId'),
            content: {
                moi: 'maailma'
            },
        })
        const stream = toReadableStream(
            new UnicastMessage({
                requestId: 'requestId', streamMessage: firstMessage
            }),
            new UnicastMessage({
                requestId: 'requestId', streamMessage: secondMessage
            })
        )

        proxyRequestStream(sendFn, request, stream)

        stream.on('end', () => {
            expect(sendFn.mock.calls).toEqual([
                [new ResendResponseResending({
                    streamId: 'streamId', streamPartition: 0, requestId: 'requestId',
                })],
                [new UnicastMessage({
                    requestId: 'requestId', streamMessage: firstMessage
                })],
                [new UnicastMessage({
                    requestId: 'requestId', streamMessage: secondMessage
                })],
                [new ResendResponseResent({
                    streamId: 'streamId', streamPartition: 0, requestId: 'requestId'
                })],
            ])
            done()
        })
    })
})
