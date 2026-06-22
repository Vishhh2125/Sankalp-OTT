/**
 * Browser WHIP publisher for MediaMTX.
 * Requires HTTPS (or localhost) for camera/mic permissions.
 */

export async function publishViaWhip(whipUrl, { video = true, audio = true } = {}) {
  if (!whipUrl) throw new Error('WHIP URL is missing');
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera/microphone access is not available in this browser');
  }

  let stream = null;
  let pc = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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

    return {
      peerConnection: pc,
      mediaStream: stream,
      stop: () => {
        stream.getTracks().forEach((t) => t.stop());
        pc.close();
      },
    };
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    pc?.close();
    if (err?.name === 'NotAllowedError') {
      throw new Error('Camera/microphone permission denied. Allow access and try again.');
    }
    if (err?.name === 'NotFoundError') {
      throw new Error('No camera or microphone found on this device.');
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
