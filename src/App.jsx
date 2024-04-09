import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import Peer from "peerjs";

const SERVER_URL = "http://192.168.1.111:3000/";
const PEER_SERVER_HOST = "/";
const PEER_SERVER_PORT = "9000";
const socket = io(SERVER_URL, {
  transports: ["websocket"], // Force WebSocket
});

function App() {
  const [users, setUsers] = useState({});
  const myId = useRef("");
  const myVideoStream = useRef(null);
  const peerRef = useRef(null);
  const [callAccepted, setCallAccepted] = useState(false);

  useEffect(() => {
    // Request permissions and get the stream
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
    .then(stream => {
      myVideoStream.current = stream;

      peerRef.current = new Peer(undefined, {
        path: '/peerjs',
        host: PEER_SERVER_HOST,
        port: PEER_SERVER_PORT,
      });

      peerRef.current.on('open', id => {
        myId.current = id;
        socket.emit('new-user', id);
      });

      peerRef.current.on('call', call => {
        call.answer(stream); // Answer the call with an audio stream.
        call.on('stream', userVideoStream => {
          // Here, you should also prepare to receive the stream.
          addAudioStream(userVideoStream);
        });
      });

      socket.on('call-made', async data => {
        if (!callAccepted) {
          const confirmed = window.confirm(`User ${data.from} is calling you. Accept this call?`);
          if (confirmed) {
            const call = peerRef.current.call(data.from, stream);
            call.on('stream', userVideoStream => {
              // Same here, prepare to receive the stream.
              addAudioStream(userVideoStream);
            });
            setCallAccepted(true);
            socket.emit('make-answer', {
              to: data.from,
              signal: data.signal,
            });
          }
        }
      });
    });

    socket.on("all-users", (currentUsers) => {
      setUsers(currentUsers);
    });

    return () => {
      if (myVideoStream.current) {
        myVideoStream.current.getTracks().forEach((track) => track.stop());
      }
      socket.disconnect();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [callAccepted]);

  /// This is a new function to handle adding audio streams to the DOM.
  function addAudioStream(stream) {
    const audio = document.createElement("audio");
    audio.srcObject = stream;
    document.body.appendChild(audio);
    audio.play();
  }

  // Ensure callUser function uses updated logic to handle two-way communication properly.
  const callUser = (userId) => {
    const call = peerRef.current.call(userId, myVideoStream.current);
    call.on("stream", (userStream) => {
      // This ensures the caller can also receive the callee's audio stream.
      addAudioStream(userStream);
    });
    setCallAccepted(true);
  };

  return (
    <div>
      <h2>Voice Calling App</h2>
      {Object.keys(users).map(
        (socketId) =>
          users[socketId] !== myId.current && (
            <button key={socketId} onClick={() => callUser(users[socketId])}>
              Call {users[socketId]}
            </button>
          )
      )}
    </div>
  );
}

export default App;
