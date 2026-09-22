import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const QRTicket: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, from: 0.5, to: 1, config: { damping: 14 } });
  const opacity = spring({ frame, fps, from: 0, to: 1, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div 
        className="glass-card"
        style={{
          width: "700px",
          height: "900px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale})`,
          opacity,
          padding: "60px",
          textAlign: "center"
        }}
      >
        <div style={{ width: "400px", height: "400px", backgroundColor: "white", borderRadius: "24px", marginBottom: "60px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          {/* Simple QR Code mock */}
          <div style={{ width: "300px", height: "300px", backgroundColor: "black", position: "relative" }}>
            <div style={{ position: "absolute", top: 20, left: 20, width: 60, height: 60, backgroundColor: "white" }} />
            <div style={{ position: "absolute", top: 20, right: 20, width: 60, height: 60, backgroundColor: "white" }} />
            <div style={{ position: "absolute", bottom: 20, left: 20, width: 60, height: 60, backgroundColor: "white" }} />
          </div>
        </div>
        <h2 className="cinzel" style={{ fontSize: "60px", margin: "0 0 20px 0" }}>QR tickets,</h2>
        <h2 className="cinzel ember-gradient" style={{ fontSize: "60px", margin: 0, paddingBottom: "20px" }}>zero drama.</h2>
      </div>
    </AbsoluteFill>
  );
};
