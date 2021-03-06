import { TrackerServer, Event as TrackerServerEvent } from '../protocol/TrackerServer'
import getLogger from '../helpers/logger'
import { NotFoundInPeerBookError } from '../connection/PeerBook'
import { LocalCandidateMessage, LocalDescriptionMessage, RelayMessage, RtcConnectMessage } from '../identifiers'
import { RtcSubTypes } from './RtcMessage'

const logger = getLogger('streamr:rtcSignallingHandlers')

export function attachRtcSignalling(trackerServer: TrackerServer): void {
    if (!(trackerServer instanceof TrackerServer)) {
        throw new Error('trackerServer not instance of TrackerServer')
    }

    function handleLocalDescription({ requestId, originator, targetNode, data }: LocalDescriptionMessage & RelayMessage) {
        if (data.type === 'answer') {
            trackerServer.sendRtcAnswer(
                targetNode,
                requestId,
                originator,
                data.description
            ).catch((err: Error) => {
                logger.debug('Failed to sendRtcAnswer to %s due to %s', targetNode, err) // TODO: better?
            })
        } else if (data.type === 'offer') {
            trackerServer.sendRtcOffer(
                targetNode,
                requestId,
                originator,
                data.description
            ).catch((err: Error) => {
                logger.debug('Failed to sendRtcOffer to %s due to %s', targetNode, err) // TODO: better?
            })
        } else {
            logger.warn('Unrecognized localDescription message: %s', data.type)
        }
    }

    function handleLocalCandidate({ requestId, originator, targetNode, data }: LocalCandidateMessage & RelayMessage) {
        trackerServer.sendRemoteCandidate(
            targetNode,
            requestId,
            originator,
            data.candidate,
            data.mid
        ).catch((err: Error) => {
            logger.debug('Failed to sendRmoteCandidate to %s due to %s', targetNode, err) // TODO: better?
        })
    }

    function handleRtcConnect({ requestId, originator, targetNode }: RtcConnectMessage & RelayMessage) {
        trackerServer.sendRtcConnect(targetNode, requestId, originator).catch((err: Error) => {
            logger.debug('Failed to sendRtcConnect to %s due to %s', targetNode, err) // TODO: better?
        })
    }

    trackerServer.on(TrackerServerEvent.RELAY_MESSAGE_RECEIVED, (relayMessage: RelayMessage, _source: string) => {
        const {
            subType,
            requestId,
            originator,
            targetNode,
        } = relayMessage
        // TODO: validate that source === originator
        try {
            if (relayMessage.subType === RtcSubTypes.LOCAL_DESCRIPTION) {
                handleLocalDescription(relayMessage)
            } else if (relayMessage.subType === RtcSubTypes.LOCAL_CANDIDATE) {
                handleLocalCandidate(relayMessage)
            } else if (relayMessage.subType === RtcSubTypes.RTC_CONNECT) {
                handleRtcConnect(relayMessage)
            } else {
                logger.warn('Unrecognized RelayMessage subType %s with contents %o', subType, relayMessage)
            }
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(originator.peerId, requestId, targetNode)
                    .catch((e) => logger.error(e))
            } else {
                throw err
            }
        }
    })
}