import { useRef } from 'react';
import { chartSeriesColor } from 'react-cheminfo/core';
import { useContainerSize } from 'react-cheminfo/ui';
import {
  Annotations,
  Axis,
  LineSeries,
  Plot,
  PlotController,
  useAxisWheelZoom,
  useAxisZoom,
  usePlotControls,
} from 'react-plot';

// Two chart series, not chrome: the trace and its integral are told apart by
// their colours, so they are read off the family's colour-blind-safe palette
// rather than following the brand.
const SPECTRUM_COLOR = chartSeriesColor(0);
const INTEGRAL_COLOR = chartSeriesColor(1);
const MIN_WIDTH = 320;
const AXIS_IDS = ['x', 'y', 'integral'];

export interface SpectrumPlotProps {
  spectrum: { x: ArrayLike<number>; y: ArrayLike<number> };
  integral?: { x: ArrayLike<number>; y: ArrayLike<number> } | null;
  showIntegral?: boolean;
  height?: number;
  /** Distinguishes plots when several are mounted at once. */
  controllerId?: string;
}

/**
 * Plots a 1H spectrum with the ppm axis running right to left, as chemists read it.
 *
 * Interaction follows the conventions of NMR software: the wheel scales the intensity
 * axis, dragging horizontally selects a shift range, and a double click returns to the
 * full spectrum. The cumulative integral is drawn on its own axis when supplied.
 * @param props - The spectrum, an optional integral, the plot height and a controller id.
 * @returns The interactive chart, sized to its container.
 */
export function SpectrumPlot(props: SpectrumPlotProps) {
  const { controllerId = 'spectrum' } = props;
  return (
    <PlotController id={controllerId}>
      <SpectrumPlotContent {...props} controllerId={controllerId} />
    </PlotController>
  );
}

function SpectrumPlotContent(props: SpectrumPlotProps) {
  const {
    spectrum,
    integral,
    showIntegral = true,
    height = 320,
    controllerId = 'spectrum',
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  // The measurement is zero until the container is first observed, and a plot
  // built at zero width paints nothing.
  const { width } = useContainerSize(containerRef);
  const plotWidth = Math.max(MIN_WIDTH, Math.floor(width));
  const controls = usePlotControls({ controllerId });

  // Wheel scales the intensity axis, so small peaks can be brought up without losing
  // the shift range currently in view.
  useAxisWheelZoom({ controllerId, direction: 'vertical', axisId: 'y' });
  // Dragging selects a shift range. Zoom is deliberately x-only: a 1H spectrum is read
  // by chemical shift, and a rectangular zoom would make it easy to lose the baseline.
  const { annotations } = useAxisZoom({
    controllerId,
    direction: 'horizontal',
  });

  const spectrumData = toPoints(spectrum);
  const integralData =
    showIntegral && integral != null && integral.x.length > 0
      ? toPoints(integral)
      : null;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div
        onDoubleClick={() => controls.resetAxes(AXIS_IDS)}
        title="Scroll to scale the intensity, drag to zoom a shift range, double click to reset"
        data-testid="spectrum-plot"
      >
        <Plot
          width={plotWidth}
          height={height}
          margin={{ top: 10, right: 16, bottom: 44, left: 60 }}
          controllerId={controllerId}
        >
          {integralData !== null && (
            <LineSeries
              data={integralData}
              xAxis="x"
              yAxis="integral"
              lineStyle={{ stroke: INTEGRAL_COLOR, strokeWidth: 1.5 }}
              label="Cumulative integral"
            />
          )}
          <LineSeries
            data={spectrumData}
            xAxis="x"
            yAxis="y"
            lineStyle={{ stroke: SPECTRUM_COLOR, strokeWidth: 1 }}
            label="Spectrum"
          />
          <Axis
            id="x"
            position="bottom"
            flip
            label="δ (ppm)"
            tickLabelFormat={formatPpm}
          />
          <Axis id="y" position="left" label="Normalized intensity" />
          {integralData !== null && (
            <Axis id="integral" position="right" label="Integral" hiddenTicks />
          )}
          {/* The drag-selection overlay. Plot rejects a bare fragment as a child, so
              the hook's annotations must be wrapped in an Annotations group. */}
          {annotations !== null && <Annotations>{annotations}</Annotations>}
        </Plot>
      </div>
    </div>
  );
}

function toPoints(data: {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
}): Array<{ x: number; y: number }> {
  const points = new Array<{ x: number; y: number }>(data.x.length);
  for (let i = 0; i < data.x.length; i++) {
    points[i] = { x: data.x[i] as number, y: data.y[i] as number };
  }
  return points;
}

function formatPpm(value: number): string {
  return value.toFixed(1);
}
