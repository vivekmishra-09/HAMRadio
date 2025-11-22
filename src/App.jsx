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

  // ==========================================
  //          CHANGE ID FUNCTION
  // ==========================================
  const changeId = () => {
    const newId = prompt("Enter new Radio ID:");

    if (!newId || !newId.trim()) {
      alert("Invalid ID!");
      return;
    }

    localStorage.setItem("myRadioId", newId.trim());

    // Reset session & reload
    localStorage.removeItem("tabCount");
    sessionStorage.removeItem("myTabRadioId");
    sessionStorage.removeItem("sessionActive");

    window.location.reload();
  };

  // ==========================================
  //     PERMANENT ID + CLEAN MULTI-TAB FIX
  // ==========================================
  useEffect(() => {
    let baseId = localStorage.getItem("myRadioId");

    if (!baseId) {
      let name = prompt("Set your Radio ID (example: vivek_01):");
      if (!name || name.trim() === "") {
        name = "radio_" + Math.random().toString(36).substring(2, 10);
      }
      localStorage.setItem("myRadioId", name);
      baseId = name;
    }

    let tabId = sessionStorage.getItem("myTabRadioId");

    if (!tabId) {
      const existingTabs = Number(localStorage.getItem("tabCount") || "0") + 1;
      localStorage.setItem("tabCount", existingTabs);

      if (existingTabs === 1) {
        tabId = baseId;
      } else {
        tabId = `${baseId}_temp${existingTabs - 1}`;
      }

      sessionStorage.setItem("myTabRadioId", tabId);
    }

    const p = new Peer(tabId);

    p.on("open", (id) => {
      setMyId(id);

      if (id === baseId) {
        log(`🆔 Permanent Radio ID: ${id}`);
      } else {
        log(`⚠️ Secondary Tab — Temporary ID: ${id}`);
      }
    });

    p.on("error", (err) => {
      if (err.type === "unavailable-id") {
        alert("⚠ ID already in use. Choose a new one.");
        changeId();
      } else {
        log(`❌ Peer error: ${err.message}`);
      }
    });

    setPeer(p);

    p.on("call", (call) => {
      log(`☎️ Incoming call from ${call.peer}`);

      try {
        call.answer(localStream || undefined);
      } catch (e) {
        log(`⚠️ Error answering call: ${e.message}`);
        call.answer();
      }

      attachCallHandlers(call);
    });

    return () => p.destroy();
  }, [localStream]);

  // ==========================================
  //             CALL HANDLER
  // ==========================================
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
          log("⚠ Click anywhere to enable audio");
        });
        log(`🎙 Receiving audio from ${call.peer}`);
      }
    });

    call.on("close", () => {
      log("📴 Call ended by peer");
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      setCallInstance(null);
    });

    call.on("error", (err) => {
      log(`❌ Call error: ${err.message}`);
    });

    log(`🔗 Call connected with ${call.peer}`);
  }

  // ==========================================
  //              MIC CONTROLS
  // ==========================================
  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      log("🎤 Microphone ON");
      setMicStarted(true);
      setTransmit(false);
    } catch (e) {
      log(`❌ Mic error: ${e.message}`);
    }
  };

  const stopMic = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = false));
    log("🔇 Microphone muted");
    setMicStarted(false);
    setTransmit(false);
  };

  const setTransmit = (on) => {
    const state = !!on;
    setTransmitting(state);
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = state));
      log(state ? "📡 TRANSMITTING" : "📥 LISTENING");
    }
  };

  const toggleTransmit = () => setTransmit(!transmitting);

  // ==========================================
  //             CALL FUNCTIONS
  // ==========================================
  const callFriend = () => {
    if (!peerIdInput.trim()) return alert("Enter friend's ID");
    if (!peer) return;

    log(`📞 Calling ${peerIdInput} ...`);

    const call = peer.call(peerIdInput.trim(), localStream || undefined);
    if (!call) {
      log("⚠ Call failed");
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

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      log("📴 Call ended");
    }
  };

  // ==========================================
  //        VOLUME + AUTOPLAY FIX
  // ==========================================
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const enableAudio = () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      document.removeEventListener("click", enableAudio);
    };

    document.addEventListener("click", enableAudio);
    return () => document.removeEventListener("click", enableAudio);
  }, []);

  // ==========================================
  //                  UI
  // ==========================================
  return (
    <div className="app-container">
      <h2>Ham Radio — 2-Person P2P</h2>

      <div className="section">
        {/* PERMANENT ID + SET NEW ID BUTTON */}
        <div style={{ margin: "8px 0", display: "flex", alignItems: "center" }}>
          <label style={{ width: 120 }}>Your Peer ID:</label>
          <span style={{ 
            fontWeight: "bold", 
            color: "#ffeb3b", 
            marginRight: 10 
          }}>
            {myId}
          </span>

          {/* SET NEW ID BUTTON */}
          <button onClick={changeId}>
            Set New ID
          </button>
        </div>

        {/* FRIEND ID INPUT */}
        <div style={{ margin: "8px 0" }}>
          <label style={{ width: 120 }}>Friend's ID:</label>
          <input
            value={peerIdInput}
            onChange={(e) => setPeerIdInput(e.target.value)}
            placeholder="Enter friend's Peer ID"
          />
          <button onClick={callFriend}>Call</button>
          <button onClick={hangUp} disabled={!callInstance}>Hang</button>
        </div>

        {/* MIC CONTROLS */}
        <div style={{ margin: "8px 0" }}>
          <label style={{ width: 120 }}>Microphone:</label>
          <button onClick={startMic} disabled={micStarted}>Start Mic</button>
          <button onClick={stopMic} disabled={!micStarted}>Stop Mic</button>
        </div>

        {/* TRANSMIT */}
        <div style={{ margin: "8px 0" }}>
          <label style={{ width: 120 }}>Transmit:</label>
          <button 
            onClick={toggleTransmit} 
            disabled={!micStarted}
            className={transmitting ? "transmit-on" : ""}
          >
            {transmitting ? "TRANSMITTING" : "OFF"}
          </button>
        </div>

        {/* VOLUME */}
        <div style={{ margin: "8px 0" }}>
          <label style={{ width: 120 }}>Volume:</label>
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
