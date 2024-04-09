import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import Peer from "peerjs";
import { confirmation } from "./components/Confirmation";

const SERVER_URL = "http://192.168.1.111:3000/";
const PEER_SERVER_HOST = "/";
const PEER_SERVER_PORT = "9000";
const socket = io(SERVER_URL, {
  transports: ["websocket"], 
});

let user_id = null

function App() {
  const [users, setUsers] = useState({});
  const myId = useRef("");
  const myVideoStream = useRef(null);
  const peerRef = useRef(null);
  const [callAccepted, setCallAccepted] = useState(false);

  useEffect(() => {
    // Request permissions and get the stream
    navigator.mediaDevices
      .getUserMedia({ video: false, audio: true })
      .then((stream) => {
        myVideoStream.current = stream;

        peerRef.current = new Peer(undefined, {
          path: "/peerjs",
          host: PEER_SERVER_HOST,
          port: PEER_SERVER_PORT,
        });

        peerRef.current.on("open", (id) => {
          myId.current = id;
          socket.emit("new-user", id);
        });

        peerRef.current.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (userVideoStream) => {
            addAudioStream(userVideoStream);
          });
        });

        socket.on("call-made", async (data) => {
          if (!callAccepted) {
            confirmation(
              `User ${data.from} is calling you. Accept this call?`
            ).then((confirmed) => {
              if (confirmed) {

                socket.emit("accept-call", {
                  to: data.from,
                  from: myId.current,
                });

                // setCallAccepted(true);
              }
            });
          }
        });

        socket.on("call-accepted", (data) => {
          const call = peerRef.current.call(data.from, myVideoStream.current);
          call.on("stream", (userVideoStream) => {
            addAudioStream(userVideoStream);
          });
          setCallAccepted(true);
        });

        socket.on("all-users", (currentUsers) => {
          setUsers(currentUsers);
        });
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
  }, []);

  const callUser = (userId) => {
    user_id = userId
    if (myVideoStream.current) {
      socket.emit("call-user", {
        userToCall: userId,
        from: myId.current,
      });
    }
  };

  useEffect(() => {
    if (callAccepted) {
      // Create a call to the specified user
      const call = peerRef.current.call(user_id, myVideoStream.current);
      call.on("stream", (userStream) => {
        // This ensures the caller can also receive the callee's audio stream.
        addAudioStream(userStream);
      });
    }
  }, [callAccepted]);

  /// This is a new function to handle adding audio streams to the DOM.
  function addAudioStream(stream) {
    const audio = document.createElement("audio");
    audio.srcObject = stream;
    document.body.appendChild(audio);
    audio.play();
  }

  return (
    <div>
      <h2>E Sim</h2>
      <h3>{myId.current}</h3>
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
