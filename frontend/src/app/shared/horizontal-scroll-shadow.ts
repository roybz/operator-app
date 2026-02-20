export interface HorizontalScrollShadowState {
  showLeft: boolean;
  showRight: boolean;
}

export const computeHorizontalScrollShadowState = (target: {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
}): HorizontalScrollShadowState => {
  const maxLeft = Math.max(0, target.scrollWidth - target.clientWidth);
  const scrollLeft = Math.max(0, Math.min(maxLeft, target.scrollLeft));
  const canScroll = maxLeft > 0.5;
  const atLeft = scrollLeft <= 0.5;
  const atRight = maxLeft - scrollLeft <= 0.5;
  return {
    showLeft: canScroll && !atLeft,
    showRight: canScroll && !atRight,
  };
};
