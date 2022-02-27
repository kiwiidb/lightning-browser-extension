import axios from "axios";
import sha256 from "crypto-js/sha256";
import Hex from "crypto-js/enc-hex";
import { parsePaymentRequest } from "invoices";

import { DecodedOffer } from "../../types";

const bolt12 = {
  findOffer(text: string) {
    const stringToText = text.trim();
    let match;
    if ((match = stringToText.match(/^lno.*/i))) {
      return match[1];
    }
    return null;
  },
  isOffer(offer: string) {
    return Boolean(findOffer(Offer));
  },
  async decodeOffer(offer: string) {
    
    let decoded = {} as DecodedOffer;
      try {
        const res = await axios.get(`https://clnhub.mainnet.getalby.com/bolt12/decode/${offer}`);
        decoded = res.data;
      } catch (e) {
        throw new Error(
          "Connection problem."
        );
      }
    return decoded;
  },
};

export default bolt12;
