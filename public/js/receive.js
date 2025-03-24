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

const createPeerConnection = async offer => {
	const pc = await new RTCPeerConnection(peerConfiguration);

	window.remoteStream = new MediaStream();
	document.getElementById('remote-stream').srcObject = window.remoteStream;

	pc.addEventListener('icecandidate', e => {
		console.log("[receive] icecandidate");
		console.log(e);
		if (e.candidate) {
			signals.emit('newIceCandidate', {
				issuer: "answerer",
				candidate: e.candidate
			})
		}
	});
	pc.addEventListener('track', e => {
		e.streams[0].getTracks().forEach(track => {
			window.remoteStream.addTrack(track, window.remoteStream);
		});
	});
	console.log("[receive] offer");
	console.log(offer.offer)
	await pc.setRemoteDescription(offer.offer);

	return pc;
};

const startReceiving = async () => {
	if (window.offers.length === 0) {
		console.log("no offers");
		return;
	}
	const offer = window.offers[0];
	const peerConnection = await createPeerConnection(offer);
	const answer = await peerConnection.createAnswer({});
	await peerConnection.setLocalDescription(answer);
	
	offer.answer = answer;
	const candidates = await signals.emitWithAck('newAnswer', offer);
	candidates.forEach(c => {
		peerConnection.addIceCandidate(c);
	});
	window.activePeerConnection = peerConnection;
};

window.offers = [];
const signals = io.connect(
	window.location.protocol + "//" + window.location.host);

signals.on('offers', offers => {
	window.offers = offers;
});

signals.on('broadcastIceCandidate', candidate => {
	console.log("[receive] got new candidate");
	console.log(candidate);
	if (window.activePeerConnection) {
		window.activePeerConnection.addIceCandidate(candidate);
	}
});

$('#btn-receive-start').on('click', evt => {
	startReceiving().then(() => {
		console.log("started!");
	}).catch(err => {
		console.log("error while starting: " + err);
	});
});