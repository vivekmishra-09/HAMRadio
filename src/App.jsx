import React, { useState, useRef, useEffect } from "react";
import Peer from "peerjs";

import "./App.css";

export default function App() {
  const logRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [peer, setPeer] = useState(null);
  const [myId, setMyId] = useState("...");
  const [peerIdInput, setPeerIdInput] = useState("");
  const [callInstance, setCallInstance] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [transmitting, setTransmitting] = useState(false);
  const [micStarted, setMicStarted] = useState(false);
  const [volume, setVolume] = useState(0.6);

  const log = (msg) => {
    if (logRef.current) {
      const div = document.createElement("div");
      div.textContent = msg;
      logRef.current.appendChild(div);
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const generateShortId = () => {
      return Math.random().toString(36).substring(2, 8);
    };

    let id = generateShortId();

    const p = new Peer(id);

    p.on("open", (id) => {
      setMyId(id);
      log(`🆔 Your Peer ID: ${id} — share this key with your friend`);
    });

    p.on("error", (err) => {
      if (err.type === "unavailable-id") {
        log("❌ Peer ID taken, generating new ID...");
        id = generateShortId();
        p.destroy();
        setPeer(null);
        const newPeer = new Peer(id);
        setPeer(newPeer);
        newPeer.on("open", (newId) => {
          setMyId(newId);
          log(`🆔 Your new Peer ID: ${newId} — share this key with your friend`);
        });
      } else {
        log(`❌ Peer error: ${err.message || err}`);
      }
    });

    setPeer(p);

    p.on("call", (call) => {
      log(`☎️ Incoming call from ${call.peer}`);
      try {
        call.answer(localStream || undefined);
      } catch (e) {
        log(`⚠️ Could not answer with local stream: ${e.message || e}`);
        call.answer();
      }
      attachCallHandlers(call);
    });

  return () => {
      p.destroy();
    };
  }, [localStream]);

  function attachCallHandlers(call) {
    if (callInstance && callInstance !== call) {
      try {
        callInstance.close();
      } catch {}
    }
    setCallInstance(call);

    call.on("stream", (remoteStream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {
          log(
            "⚠️ Click anywhere on the page if you do not hear audio (browser autoplay policy)"
          );
        });
        log(`🎙 Receiving audio from ${call.peer}`);
      }
    });

    call.on("close", () => {
      log("📴 Peer ended call");
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      setCallInstance(null);
    });

    call.on("error", (err) => {
      log(`❌ Call error: ${err?.message || err}`);
    });

    log(`🔗 Call connected with ${call.peer}`);
  }

  const startMic = async () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => (track.enabled = true));
      log("🔊 Microphone started (unmuted)");
      setMicStarted(true);
      setTransmit(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.play().catch(() => {});
      }
      log("🔊 Microphone started");
      setMicStarted(true);
      setTransmit(false);
    } catch (e) {
      log(`❌ Microphone access denied or error: ${e.message || e}`);
    }
  };

  const stopMic = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => (track.enabled = false));
    log("🔇 Microphone stopped (muted)");
    setMicStarted(false);
    setTransmit(false);
  };

  const setTransmit = (on) => {
    const transmittingOn = !!on;
    setTransmitting(transmittingOn);
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = transmittingOn));
      log(
        transmittingOn
          ? "📡 You are TRANSMITTING"
          : "📥 You are LISTENING (transmit OFF)"
      );
    } else {
      setTransmitting(false);
      log("❌ No mic available; transmit OFF");
    }
  };

  const toggleTransmit = () => {
    setTransmit(!transmitting);
  };

  const callFriend = () => {
    if (!peerIdInput.trim()) return alert("Enter friend ID (the key they shared)");
    if (!peer) return;

    log(`📞 Calling ${peerIdInput} ...`);
    const streamToSend = localStream || undefined;
    const call = peer.call(peerIdInput.trim(), streamToSend);
    if (!call) {
      log("⚠️ Call failed (no connection)");
      return;
    }
    attachCallHandlers(call);
  };

  const hangUp = () => {
    if (callInstance) {
      try {
        callInstance.close();
      } catch {}
      setCallInstance(null);
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      log("📴 Call ended");
    }
  };

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    function allowAudioPlayback() {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      document.removeEventListener("click", allowAudioPlayback);
    }
    document.addEventListener("click", allowAudioPlayback);
    return () => document.removeEventListener("click", allowAudioPlayback);
  }, []);

  return (
    <div className="app-container">
      <h2>Ham Radio — 2-Person P2P</h2>
  
      <div className="section">
        <div style={{ margin: "8px 0" }}>
          <label style={{ display: "inline-block", width: 110 }}>Your Peer ID:</label>
          <span style={{ fontWeight: "bold", color: "#ffeb3b", marginLeft: 6 }}>
            {myId}
          </span>
        </div>
  
        <div style={{ margin: "8px 0" }}>
          <label style={{ display: "inline-block", width: 110 }}>Friend's ID:</label>
          <input
            value={peerIdInput}
            onChange={(e) => setPeerIdInput(e.target.value)}
            placeholder="Enter friend's Peer ID"
          />
          <button onClick={callFriend}>Call Friend</button>
          <button onClick={hangUp} disabled={!callInstance}>
            Hang Up
          </button>
        </div>
  
        <div style={{ margin: "8px 0" }}>
          <label style={{ display: "inline-block", width: 110 }}>Microphone:</label>
          <button onClick={startMic} disabled={micStarted}>
            Start Mic
          </button>
          <button onClick={stopMic} disabled={!micStarted}>
            Stop Mic
          </button>
        </div>
  
        <div style={{ margin: "8px 0" }}>
          <label style={{ display: "inline-block", width: 110 }}>Transmit:</label>
          <button
            className={transmitting ? "transmit-on" : ""}
            onClick={toggleTransmit}
            disabled={!micStarted}
          >
            {transmitting ? "TRANSMITTING" : "OFF"}
          </button>
          <small style={{ marginLeft: 10 }}>
            (Tap to toggle transmit. When OFF, you only listen.)
          </small>
        </div>
  
        <div style={{ margin: "8px 0" }}>
          <label style={{ display: "inline-block", width: 110 }}>Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
  
        <div ref={logRef} className="log-box"></div>
  
        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );  
}
