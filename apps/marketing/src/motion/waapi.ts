import matchMedia from "./matchMedia";

export type Target = HTMLElement | Array<HTMLElement>;

export interface AnimateOptions {
  delay?: number;
  duration?: number;
  ease?: string;
  repeat?: number;
}

export interface AnimatableProperties {
  x?: string | number;
  y?: string | number;
  rotate?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  autoAlpha?: number;
  backgroundColor?: string;
  color?: string;
  borderRadius?: number;
  filter?: string;
}

export interface TimelineControls {
  from: (
    target: Target,
    keyframes: AnimatableProperties | AnimatableProperties[],
    options?: AnimateOptions,
  ) => TimelineControls;
  kill: () => TimelineControls;
  pause: () => TimelineControls;
  play: () => TimelineControls;
  set: (target: Target, props: AnimatableProperties) => TimelineControls;
  to: (
    target: Target,
    keyframes: AnimatableProperties | AnimatableProperties[],
    options?: AnimateOptions,
  ) => TimelineControls;
}

const resolveKeyframe = (props: AnimatableProperties): Keyframe => {
  const transforms: string[] = [];
  const rest: Record<string, unknown> = {};

  if (props.x !== undefined) {
    const x = typeof props.x === "number" ? `${props.x}px` : props.x;
    transforms.push(`translateX(${x})`);
  }
  if (props.y !== undefined) {
    const y = typeof props.y === "number" ? `${props.y}px` : props.y;
    transforms.push(`translateY(${y})`);
  }
  if (props.rotate !== undefined) transforms.push(`rotate(${props.rotate}deg)`);
  if (props.scale !== undefined) transforms.push(`scale(${props.scale})`);
  if (props.scaleX !== undefined) transforms.push(`scaleX(${props.scaleX})`);
  if (props.scaleY !== undefined) transforms.push(`scaleY(${props.scaleY})`);

  if (transforms.length) rest.transform = transforms.join(" ");

  if (props.autoAlpha !== undefined) {
    rest.opacity = props.autoAlpha;
    rest.visibility = props.autoAlpha > 0 ? "visible" : "hidden";
  }
  if (props.backgroundColor !== undefined) rest.backgroundColor = props.backgroundColor;
  if (props.color !== undefined) rest.color = props.color;
  if (props.borderRadius !== undefined) rest.borderRadius = `${props.borderRadius}px`;
  if (props.filter !== undefined) rest.filter = props.filter;

  return rest as Keyframe;
};

const buildTiming = (delay: number, options: AnimateOptions): KeyframeAnimationOptions => ({
  duration: (options.duration ?? 0.3) * 1000,
  delay: delay * 1000,
  easing: options.ease ?? "ease",
  iterations: options.repeat === -1 ? Infinity : (options.repeat ?? 0) + 1,
  fill: "forwards",
});

const animate = (
  target: Target,
  keyframes: AnimatableProperties | AnimatableProperties[],
  options: AnimateOptions = {},
) => {
  const els = Array.isArray(target) ? target : [target];
  const normalized = Array.isArray(keyframes) ? keyframes : [keyframes];
  const resolved = normalized.map(resolveKeyframe);

  const anims = els.map((el) => el.animate(resolved, buildTiming(options.delay ?? 0, options)));

  return {
    pause: () => anims.forEach((a) => a.pause()),
    play: () => anims.forEach((a) => a.play()),
    progress: () => {
      const a = anims[0];
      const duration = Number(a.effect?.getComputedTiming().duration ?? 1);
      return Number(a.currentTime) / duration;
    },
    stop: () => anims.forEach((a) => a.cancel()),
  };
};

const set = (target: Target, props: AnimatableProperties) => {
  animate(target, [props, props], { duration: 0 });
};

const timeline = (): TimelineControls => {
  const steps: {
    at: number;
    keyframes: AnimatableProperties[];
    options: AnimateOptions;
    target: Target;
  }[] = [];

  let active: Animation[] = [];
  let cursor = 0;

  let scheduled = false;
  const scheduleRun = () => {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        run();
      });
    }
  };

  const addTo = (
    target: Target,
    keyframes: AnimatableProperties | AnimatableProperties[],
    options: AnimateOptions = {},
  ) => {
    const normalized = Array.isArray(keyframes) ? keyframes : [keyframes];
    steps.push({ target, keyframes: normalized, options, at: cursor });
    cursor += (options.duration ?? 0.3) + (options.delay ?? 0);
    scheduleRun();
  };

  const addFrom = (
    target: Target,
    keyframes: AnimatableProperties | AnimatableProperties[],
    options: AnimateOptions = {},
  ) => {
    const normalized = Array.isArray(keyframes) ? keyframes : [keyframes];
    addTo(target, [...normalized].reverse(), options);
  };

  const run = () => {
    active = [];
    steps.forEach(({ target, keyframes, options, at }) => {
      const els = Array.isArray(target) ? target : [target];
      const resolved = keyframes.map(resolveKeyframe);
      els.forEach((el) => {
        const anim = el.animate(resolved, buildTiming(at + (options.delay ?? 0), options));
        active.push(anim);
      });
    });
  };

  const tl: TimelineControls = {
    to: (target, keyframes, options = {}) => {
      addTo(target, keyframes, options);
      return tl;
    },
    from: (target, keyframes, options = {}) => {
      addFrom(target, keyframes, options);
      return tl;
    },
    set: (target, props) => {
      const els = Array.isArray(target) ? target : [target];
      const keyframe = resolveKeyframe(props);
      els.forEach((el) => {
        Object.assign(el.style, keyframe);
      });
      return tl;
    },
    play: () => {
      run();
      return tl;
    },
    pause: () => {
      active.forEach((a) => a.pause());
      return tl;
    },
    kill: () => {
      active.forEach((a) => a.cancel());
      return tl;
    },
  };

  return tl;
};

const to = (
  target: Target,
  keyframes: AnimatableProperties | AnimatableProperties[],
  options?: AnimateOptions,
) => animate(target, keyframes, options);

const waapi = { animate, matchMedia, set, timeline, to };

export default waapi;
