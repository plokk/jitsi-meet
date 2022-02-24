import {
    CONFERENCE_JOINED,
    CONFERENCE_WILL_LEAVE,
    getCurrentConference
} from '../base/conference';
import { JitsiConferenceEvents } from '../base/lib-jitsi-meet';
import { MiddlewareRegistry } from '../base/redux';
import { TRACK_UPDATED, TRACK_REMOVED } from '../base/tracks';

import { UPDATE_FACE_COORDINATES } from './actionTypes';
import {
    loadWorker,
    stopFaceRecognition,
    startFaceRecognition
} from './actions';
import { FACE_BOX_EVENT_TYPE } from './constants';

MiddlewareRegistry.register(({ dispatch, getState }) => next => action => {
    const state = getState();
    const { faceCoordinatesSharing } = state['features/base/config'];

    if (!getCurrentConference(state)) {
        return next(action);
    }

    if (action.type === CONFERENCE_JOINED) {
        if (faceCoordinatesSharing?.enabled) {
            dispatch(loadWorker());
        }

        // allow using remote face centering data when local face centering is not enabled
        action.conference.on(
            JitsiConferenceEvents.ENDPOINT_MESSAGE_RECEIVED,
            (...args) => {
                if (args && args.length >= 2) {
                    const [ { _id }, eventData ] = args;

                    if (eventData.type === FACE_BOX_EVENT_TYPE) {
                        dispatch({
                            type: UPDATE_FACE_COORDINATES,
                            faceBox: eventData.faceBox,
                            id: _id
                        });
                    }
                }
            });

        return next(action);
    }

    if (!faceCoordinatesSharing?.enabled) {
        return next(action);
    }

    switch (action.type) {
    case CONFERENCE_WILL_LEAVE : {
        dispatch(stopFaceRecognition());

        return next(action);
    }
    case TRACK_UPDATED: {
        const { videoType } = action.track.jitsiTrack;

        if (videoType === 'camera') {
            const { muted, videoStarted } = action.track;

            // addresses video starting for the first time
            if (videoStarted === true) {
                dispatch(startFaceRecognition());
            }

            if (muted !== undefined) {
                // addresses video mute state changes
                if (muted) {
                    dispatch(stopFaceRecognition());
                } else {
                    dispatch(startFaceRecognition());
                }
            }
        }

        return next(action);
    }
    case TRACK_REMOVED: {
        const { videoType } = action.track.jitsiTrack;

        if ([ 'camera', 'desktop' ].includes(videoType)) {
            dispatch(stopFaceRecognition());
        }

        return next(action);
    }
    }

    return next(action);
});
