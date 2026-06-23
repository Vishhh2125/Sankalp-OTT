/**
 * Browser WHIP publisher for MediaMTX.
 * Requires HTTPS (or localhost) for camera/mic permissions.
 */

export async function publishViaWhip(whipUrl, { video = true, audio = true, screenShare = false } = {}) {
  if (!whipUrl) throw new Error('WHIP URL is missing');

  let stream = null;
  let pc = null;
  let displayStream = null;
  let micStream = null;
  let audioCtx = null;

  try {
    if (screenShare) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser');
      }

      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 960 },
          height: { max: 960 }
        },
        audio: true // system/tab audio
      });

      if (audio) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true
            },
            video: false
          });

          // Mix the screen capture and microphone audio using Web Audio API
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const destination = audioCtx.createMediaStreamDestination();

          let displayHasAudio = displayStream.getAudioTracks().length > 0;
          let micHasAudio = micStream.getAudioTracks().length > 0;

          if (displayHasAudio) {
            const displaySource = audioCtx.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]));
            displaySource.connect(destination);
          }

          if (micHasAudio) {
            const micSource = audioCtx.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]]));
            micSource.connect(destination);
          }

          const mixedStream = new MediaStream();
          displayStream.getVideoTracks().forEach((track) => mixedStream.addTrack(track));
          
          if (displayHasAudio || micHasAudio) {
            destination.stream.getAudioTracks().forEach((track) => mixedStream.addTrack(track));
          }

          stream = mixedStream;
        } catch (micErr) {
          console.warn('Microphone access failed for screen sharing, using screen audio only:', micErr);
          stream = displayStream;
        }
      } else {
        stream = displayStream;
      }
    } else {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera/microphone access is not available in this browser');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 960, max: 960 },
          height: { ideal: 540, max: 960 }
        } : false,
        audio
      });
    }

    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    stream.getTracks().forEach((track) => {
      const transceiver = pc.addTransceiver(track, {
        direction: 'sendonly',
        streams: [stream],
      });

      if (track.kind === 'video' && RTCRtpSender.getCapabilities) {
        const capabilities = RTCRtpSender.getCapabilities('video');
        const codecs = capabilities?.codecs || [];
        const h264 = codecs.filter((codec) => codec.mimeType?.toLowerCase() === 'video/h264');
        const rest = codecs.filter((codec) => codec.mimeType?.toLowerCase() !== 'video/h264');
        if (h264.length) transceiver.setCodecPreferences([...h264, ...rest]);
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise((resolve, reject) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timeout = setTimeout(() => resolve(), 3000);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
      pc.onicecandidateerror = (e) => {
        clearTimeout(timeout);
        reject(new Error(e.errorText || 'ICE gathering failed'));
      };
    });

    const res = await fetch(whipUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription.sdp,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `WHIP publish failed (${res.status})`);
    }

    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    const session = {
      peerConnection: pc,
      mediaStream: stream,
      displayStream,
      micStream,
      audioContext: audioCtx,
      onStop: null,
      replaceTracks: async (newVideoTrack, newAudioTrack) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        const audioSender = senders.find((s) => s.track?.kind === 'audio');

        if (videoSender && newVideoTrack) {
          await videoSender.replaceTrack(newVideoTrack);
        }
        if (audioSender && newAudioTrack) {
          await audioSender.replaceTrack(newAudioTrack);
        }
      },
      stop: () => {
        stream.getTracks().forEach((t) => t.stop());
        displayStream?.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
        pc.close();
      },
    };

    // If screen sharing is stopped using browser native floating UI
    if (screenShare && displayStream) {
      displayStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (session.onStop) {
            session.onStop();
          }
        };
      });
    }

    return session;
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    displayStream?.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
    pc?.close();
    if (err?.name === 'NotAllowedError') {
      throw new Error('Permission denied. Allow access and try again.');
    }
    if (err?.name === 'NotFoundError') {
      throw new Error('No input sources found on this device.');
    }
    throw err;
  }
}

export function isWhipEnvironmentSupported() {
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const isSecure = window.location.protocol === 'https:' || isLocalhost;
  return isSecure && !!navigator.mediaDevices?.getUserMedia;
}
