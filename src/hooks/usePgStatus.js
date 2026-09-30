import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../utils/api';

const POLL_MS = 6000;
const MAX_POLLS = 20;

/**
 * Looks a payment up by the token the gateway redirect carried, or by a typed reference,
 * and keeps looking while it is still pending — the gateway often sends the payer back a
 * moment before the vendor has settled the result.
 *
 * Only the outcome, amount, UTR and card come back; the backend never sends charges.
 */
export function usePgStatus({ token, reference }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const polls = useRef(0);

  const check = useCallback(async () => {
    if (!token && !reference) return null;
    setLoading(true);
    setError(null);
    try {
      const query = token
        ? `token=${encodeURIComponent(token)}`
        : `referenceId=${encodeURIComponent(reference)}`;
      const res = await fetch(apiUrl(`/api/pg/status?${query}`));
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(null);
        setError(body?.message ?? body?.detail ?? `Could not check the payment (${res.status}).`);
        return null;
      }
      setStatus(body);
      return body;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, reference]);

  useEffect(() => {
    if (!token && !reference) return undefined;
    polls.current = 0;
    let timer;
    let stopped = false;
    const run = async () => {
      const result = await check();
      polls.current += 1;
      if (!stopped && result?.outcome === 'pending' && polls.current < MAX_POLLS) {
        timer = setTimeout(run, POLL_MS);
      }
    };
    run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token, reference, check]);

  return { status, error, loading, refresh: check };
}
