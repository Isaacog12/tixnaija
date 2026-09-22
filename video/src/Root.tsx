import React from "react";
import "./index.css";
import { Composition } from "remotion";
import { TixNaijaLaunch } from "./TixNaijaLaunch";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TixNaijaLaunch"
        component={TixNaijaLaunch}
        durationInFrames={30 * 30}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
