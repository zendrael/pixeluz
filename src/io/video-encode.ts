import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  type OutputFormat,
  type VideoCodec,
} from "mediabunny";
import type { ImageBuffer, Rgba } from "../domain/types";
import { prepareVideoFrames, type VideoFrame } from "./video";

const MP4_CODECS: VideoCodec[] = ["avc", "av1", "hevc"];
const WEBM_CODECS: VideoCodec[] = ["vp9", "vp8", "av1"];

export interface EncodedVideo {
  bytes: Uint8Array;
  mime: string;
  extension: string;
}

export async function encodeAnimation(
  frames: VideoFrame[],
  options: { scale: number; background: Rgba },
): Promise<EncodedVideo | null> {
  if (typeof document === "undefined" || frames.length === 0) return null;
  const prepared = prepareVideoFrames(frames, options);
  const width = prepared[0]?.image.width ?? 0;
  const height = prepared[0]?.image.height ?? 0;
  if (width === 0 || height === 0) return null;
  const quality = new Quality("high");
  const mp4 = new Mp4OutputFormat({ fastStart: "in-memory" });
  const mp4Codec = await firstCodec(mp4, MP4_CODECS, width, height, quality);
  if (mp4Codec) {
    const encoded = await writeVideo(prepared, mp4, mp4Codec, quality);
    if (encoded) return encoded;
  }
  const webm = new WebMOutputFormat();
  const webmCodec = await firstCodec(webm, WEBM_CODECS, width, height, quality);
  if (!webmCodec) return null;
  return writeVideo(prepared, webm, webmCodec, quality);
}

async function firstCodec(
  format: OutputFormat,
  preferred: VideoCodec[],
  width: number,
  height: number,
  quality: Quality,
): Promise<VideoCodec | null> {
  const supported = new Set(format.getSupportedVideoCodecs());
  const candidates = preferred.filter((codec) => supported.has(codec));
  if (candidates.length === 0) return null;
  return getFirstEncodableVideoCodec(candidates, { width, height, quality });
}

async function writeVideo(
  frames: VideoFrame[],
  format: Mp4OutputFormat | WebMOutputFormat,
  codec: VideoCodec,
  quality: Quality,
): Promise<EncodedVideo | null> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const first = frames[0];
  if (!context || !first) return null;
  canvas.width = first.image.width;
  canvas.height = first.image.height;
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new CanvasSource(canvas, { codec, quality });
  output.addVideoTrack(source);
  try {
    await output.start();
    let timestamp = 0;
    for (const frame of frames) {
      paint(context, frame.image);
      const duration = frame.durationMs / 1000;
      await source.add(timestamp, duration);
      timestamp += duration;
    }
    await output.finalize();
  } catch {
    await output.cancel().catch(() => undefined);
    return null;
  }
  if (!target.buffer) return null;
  const extension = format.fileExtension.startsWith(".") ? format.fileExtension : `.${format.fileExtension}`;
  return { bytes: new Uint8Array(target.buffer), mime: format.mimeType, extension };
}

function paint(context: CanvasRenderingContext2D, image: ImageBuffer): void {
  const canvas = context.canvas;
  if (canvas.width !== image.width || canvas.height !== image.height) {
    canvas.width = image.width;
    canvas.height = image.height;
  }
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
}
