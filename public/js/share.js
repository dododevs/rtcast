const peerConfiguration = {
	iceServers: [
		{
			urls: [
				"stun:stun.l.google.com:19302",
				"stun:stun1.l.google.com:19302"
			]
		}
	]
};

const signals = io.connect(
	window.location.protocol + "//" + window.location.host);

signals.on('broadcastIceCandidate', candidate => {
	console.log("[share] got new candidate");
	if (window.activePeerConnection) {
		window.activePeerConnection.addIceCandidate(candidate);
	}
});

signals.on('answerResponse', offer => {
	if (window.activePeerConnection) {
		window.activePeerConnection.setRemoteDescription(offer.answer);
	}
});

const createPeerConnection = async stream => {
	const pc = await new RTCPeerConnection(peerConfiguration);
	stream.getTracks().forEach(track => pc.addTrack(track, stream));

	window.remoteStream = new MediaStream();
	document.getElementById('remote-stream').srcObject = window.remoteStream;

	pc.addEventListener('icecandidate', e => {
		console.log("[share] icecandidate");
		console.log(e);
		if (e.candidate) {
			signals.emit('newIceCandidate', {
				issuer: "offerer",
				candidate: e.candidate
			});
		}
	});
	pc.addEventListener('track', e => {
		e.streams[0].getTracks().forEach(track => {
			window.remoteStream.addTrack(track, window.remoteStream);
		});
	});
	return pc;
};

const getScreenCaptureStream = async () => {
  return await navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: "always"
    },
    audio: false
  });
};

const startSharing = async () => {
	const stream = await getScreenCaptureStream();
	const peerConnection = await createPeerConnection(stream);
	const offer = await peerConnection.createOffer();

	await peerConnection.setLocalDescription(offer);
	console.log("[share] offer");
	console.log(offer);
	signals.emit("newOffer", offer);

	window.activePeerConnection = peerConnection;
};

$('#btn-share-start').on('click', evt => {
	startSharing().then(() => {
		console.log("started!");
	}).catch(err => {
		console.log("error while starting: " + err);
	});
});