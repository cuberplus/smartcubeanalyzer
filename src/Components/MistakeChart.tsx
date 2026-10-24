import { CSSProperties } from 'react';
import { OverlayTrigger, ProgressBar, Tooltip } from 'react-bootstrap';
import { ChartCard } from '../Helpers/ChartHelpers';
import { SEGMENT_COLORS } from '../Helpers/ChartColors';
import { MISTAKES, mistakeKey, mistakeLabel, MistakeSummary } from '../Helpers/MistakeAnalysis';

export function MistakeChart({ summary }: { summary: MistakeSummary }) {
    const maxCount = Math.max(0, ...summary.counts.map(row => row.count));
    return <ChartCard label="Mistakes" title={`Mistakes in the last ${summary.sampleCount.toLocaleString()} ${summary.sampleCount === 1 ? 'solve' : 'solves'}`} scrollable>
        <div role="list" aria-label="Mistake counts">
            {summary.counts.map(row => <div key={mistakeKey(row)} role="listitem" aria-label={`${mistakeLabel(row)}: ${row.count} of ${summary.sampleCount} solves`} className="mb-2">
                <div className="d-flex justify-content-between gap-2 small"><OverlayTrigger placement="top" overlay={<Tooltip id={`mistake-${mistakeKey(row)}`}>{MISTAKES[row.kind].rule}</Tooltip>}>
                    <button type="button" className="btn btn-link p-0 border-0 text-body text-start text-decoration-none" style={{ fontSize: 'inherit' }} aria-label={`About ${mistakeLabel(row)}`}>{mistakeLabel(row)} ⓘ</button>
                </OverlayTrigger><strong className="text-nowrap">{row.count}</strong></div>
                <ProgressBar now={maxCount ? row.count / maxCount * 100 : 0} style={{ height: 12, '--bs-progress-bar-bg': SEGMENT_COLORS.execution } as CSSProperties} aria-hidden="true" />
            </div>)}
        </div>
        <details className="small"><summary>How mistakes are detected</summary>
            <p className="mt-2">These are whole-solve practice signals, not proof of an error; selecting individual stages does not change the counts. Missing moves/timings are not assumed clean. The stage logs alone cannot establish whether 3+ pairs were solved before the cross.</p>
            <p>Undo/redundant-turn rows appear for steps where they were detected. AUF uses the source-specific last-layer face.</p>
        </details>
    </ChartCard>;
}
