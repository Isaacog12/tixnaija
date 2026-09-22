import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { Hook } from "./scenes/Hook";
import { Search } from "./scenes/Search";
import { Payment } from "./scenes/Payment";
import { QRTicket } from "./scenes/QRTicket";
import { Outro } from "./scenes/Outro";

export const TixNaijaLaunch: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "var(--bg)" }}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 50% 50%, var(--primary) 0%, transparent 50%)",
          opacity: 0.1,
          transform: "scale(2)",
        }}
      />
      <Series>
        <Series.Sequence durationInFrames={180}>
          <Hook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={180}>
          <Search />
        </Series.Sequence>
        <Series.Sequence durationInFrames={180}>
          <Payment />
        </Series.Sequence>
        <Series.Sequence durationInFrames={180}>
          <QRTicket />
        </Series.Sequence>
        <Series.Sequence durationInFrames={180}>
          <Outro />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
