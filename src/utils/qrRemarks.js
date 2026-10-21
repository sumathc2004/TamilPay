import { pick } from './pick';

/**
 * What to show in a QR request's Remarks column. A request has two kinds of remark:
 *  - the note the retailer typed when creating it (kept by this app, sent as "retailerRemarks"), and
 *  - on a rejected request, the admin's reason (the server's own "remarks").
 * Both are shown when both exist, so a rejection never hides the retailer's note.
 */
export function qrRemarkParts(row) {
  const note = String(row?.retailerRemarks ?? '').trim();
  const server = String(pick(row ?? {}, ['remarks', 'Remarks']) ?? '').trim();
  const rejected = String(row?.status ?? row?.Status ?? '').toUpperCase() === 'REJECTED';
  return { note: note || (rejected ? '' : server), reason: rejected ? server : '' };
}

/** The same, as one line of text (for the report table and its exports). */
export function qrRemarkText(row) {
  const { note, reason } = qrRemarkParts(row);
  return [note, reason && `Rejected: ${reason}`].filter(Boolean).join(' · ');
}
