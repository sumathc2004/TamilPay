// Bank symbols (the mark alone, not the wordmark) for the BBPS credit card billers, from public sources:
//  - the open-source indian-banks logo set on jsDelivr, keyed by the bank's 4-letter IFSC
//    code — the same set the upstream already uses for saved IMPS accounts;
//  - Google's favicon service, for the few banks that set does not cover.
// Keyed by the exact billerId: prefixes are shared ("BANK…" is BoB, Bank of India and Bank
// of Maharashtra), so a prefix alone would show the wrong logo. Every URL here was checked to
// return an image. Saraswat and Suryoday have no public logo in either source, so they are
// left out and keep their initials badge.

const IFSC_LOGO = (code) => `https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@main/assets/logos/${code}/symbol.svg`;
const FAVICON = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

const BILLER_LOGOS = {
  AUBA00000NAT3Q: IFSC_LOGO('aubl'), // AU Bank
  AXIS00000NATKF: IFSC_LOGO('utib'), // Axis Bank
  BAND00010NATWS: IFSC_LOGO('bdbl'), // Bandhan Bank
  BANK00026NATRG: IFSC_LOGO('bkid'), // Bank of India
  BANK00000NAT0Q: IFSC_LOGO('mahb'), // Bank of Maharashtra
  BANK00000NATKB: IFSC_LOGO('barb'), // BoB
  ONEB00000NATS1: IFSC_LOGO('barb'), // One - BOBCARD (issued by Bank of Baroda)
  CANA00000NATDO: IFSC_LOGO('cnrb'), // Canara Bank
  CSBO00026NATWL: IFSC_LOGO('csbk'), // CSB One
  EDGE00000NATWS: IFSC_LOGO('csbk'), // Edge CSB Bank RuPay
  CUBC00000NATGR: IFSC_LOGO('ciub'), // City Union Bank
  DBSB00000NATPR: FAVICON('dbs.com'), // DBS Bank
  DCBB00017NATCL: IFSC_LOGO('dcbl'), // DCB Bank
  DHAN00000NAT6X: IFSC_LOGO('dlxb'), // Dhanlaxmi Bank
  ESAF00000NATPB: IFSC_LOGO('esmf'), // ESAF Small Finance Bank
  FEDE00000NATDL: IFSC_LOGO('fdrl'), // Federal Bank
  HDFC00000NATW1: IFSC_LOGO('hdfc'), // HDFC Bank
  HDFC00000NATBH: IFSC_LOGO('hdfc'), // HDFC Bank Pixel
  HSBC00000NAT4M: FAVICON('hsbc.co.in'), // HSBC
  ICIC00000NATSI: IFSC_LOGO('icic'), // ICICI Bank
  IDBI00000NAT7G: IFSC_LOGO('ibkl'), // IDBI Bank
  IDFC00000NATFQ: IFSC_LOGO('idfb'), // IDFC FIRST Bank
  INDI00000NATFA: IFSC_LOGO('idib'), // Indian Bank
  INDI00000NAT8I: IFSC_LOGO('idib'), // One - Indian Bank
  INDU00000NATL1: IFSC_LOGO('indb'), // IndusInd Bank
  IOBC00000NATI3: IFSC_LOGO('ioba'), // Indian Overseas Bank
  JAND00020NAT9D: IFSC_LOGO('jaka'), // J&K Bank
  KOTA00000NATED: IFSC_LOGO('kkbk'), // Kotak Mahindra Bank
  PUNJ00000NATEY: IFSC_LOGO('punb'), // Punjab National Bank
  RBLB00000NATN3: IFSC_LOGO('ratn'), // RBL Bank
  SBIC00000NATDN: IFSC_LOGO('sbin'), // SBI Card
  SLIC00016NAT9L: FAVICON('www.slice.bank.in'), // slice
  SOUT00000NAT68: IFSC_LOGO('sibl'), // One - South Indian Bank
  TAMI00027NAT9C: IFSC_LOGO('tmbl'), // Tamilnad Mercantile Bank
  UNIO00000NATG9: IFSC_LOGO('ubin'), // Union Bank of India
  YESB00000NAT8U: IFSC_LOGO('yesb'), // Yes Bank
};

/** The logo URL for a biller, or null when there is none (the caller shows initials). */
export function billerLogo(billerId) {
  return BILLER_LOGOS[billerId] ?? null;
}
