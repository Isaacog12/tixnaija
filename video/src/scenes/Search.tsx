import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Search: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const searchY = spring({ frame, fps, from: 800, to: 0, config: { damping: 14 } });
  const textToType = "Find the hottest events in town";
  const typeIndex = Math.floor(Math.max(0, frame - 30) / 3);
  const displayedText = textToType.slice(0, typeIndex);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div 
        className="glass-card"
        style={{
          width: "800px",
          height: "140px",
          display: "flex",
          alignItems: "center",
          padding: "0 40px",
          transform: `translateY(${searchY}px)`,
        }}
      >
        <div style={{ width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "var(--primary)", opacity: 0.5, marginRight: "30px", flexShrink: 0 }} />
        <span style={{ fontSize: "40px", fontWeight: 500, color: displayedText.length > 0 ? "var(--text)" : "gray" }}>
          {displayedText.length > 0 ? displayedText : "Search..."}
        </span>
      </div>
    </AbsoluteFill>
  );
};
