import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const App = () => {
  const userVideo = useRef();
  const partnerVideo = useRef();
  const socket = useRef();
  const peerRef = useRef();
  const [users, setUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  function getUserMedia() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (userVideo.current) userVideo.current.srcObject = stream;
        stream.getTracks().forEach((track) => {
          peerRef.current.addTrack(track, stream);
        });
      }).catch((e) => {
        console.error("getUserMedia Error: ", e);
      });
  }

  useEffect(() => {
    socket.current = io.connect("http://localhost:3001");
    getUserMedia()

    socket.current.on("users", (users) => {
      setUsers(users.filter((user) => user.userId !== socket.current.id));
    });

    socket.current.on("offer", (incoming) => {
      setIncomingCall({ from: incoming.from, sdp: incoming.sdp });
    });

    socket.current.on("answer", (message) => {
      peerRef.current.setRemoteDescription(new RTCSessionDescription(message.sdp));
    });

    socket.current.on("candidate", (incoming) => {
      const candidate = new RTCIceCandidate(incoming);
      peerRef.current.addIceCandidate(candidate);
    });

    const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] };
    peerRef.current = new RTCPeerConnection(configuration);

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit("send-candidate", { candidate: event.candidate });
      }
    };

    peerRef.current.ontrack = (event) => {
      partnerVideo.current.srcObject = event.streams[0];
    };

    peerRef.current.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${peerRef.current.iceConnectionState}`);
    };
  }, []);

  function callUser(targetId) {
    peerRef.current.createOffer().then((offer) => {
      return peerRef.current.setLocalDescription(offer);
    }).then(() => {
      const payload = {
        target: targetId,
        from: socket.current.id,
        sdp: peerRef.current.localDescription,
      };
      socket.current.emit("call-user", payload);
    });
  }

  function acceptCall() {
    setCallAccepted(true);
    const desc = new RTCSessionDescription(incomingCall.sdp);
    peerRef.current.setRemoteDescription(desc).then(() => {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    }).then((stream) => {
      stream.getTracks().forEach((track) => peerRef.current.addTrack(track, stream));
    }).then(() => {
      return peerRef.current.createAnswer();
    }).then((answer) => {
      return peerRef.current.setLocalDescription(answer);
    }).then(() => {
      const payload = {
        target: incomingCall.from,
        sdp: peerRef.current.localDescription,
      };
      socket.current.emit("accept-call", payload);
    });
  }

  return (
    <div>
      <video autoPlay ref={userVideo} muted />
      <video autoPlay ref={partnerVideo} />
      {incomingCall && !callAccepted && (
        <div>
          <h2>Incoming call from {incomingCall.from}</h2>
          <button onClick={acceptCall}>Accept</button>
        </div>
      )}
      <div>
        {users.map((user) => (
          <button key={user.userId} onClick={() => callUser(user.userId)}>
            Call {user.userId}
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;