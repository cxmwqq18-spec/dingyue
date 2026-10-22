// Display widths of the Aidreamcapes v2 pictures that carry a generated
// variant set, measured from the stylesheet that renders them.
//
// `sizes` tells the browser how wide the picture is on screen so it can pick
// the right candidate. A wrong value never changes the box - the stylesheet
// owns that - but an over-estimate costs bytes and an under-estimate costs
// sharpness, so every value below is the real column width of the grid the
// picture sits in, rounded up.
//
// The derivations reference the rules in `styles.ts` and `home-experience.css`.

/** `.v-fresh-media` is the second column of `.v-fresh-grid` and holds two columns of its own. */
export const AIDREAMCAPES_V2_FRESH_MEDIA_SIZES = "(max-width: 760px) 354px, 267px";

/** `.v-picker-grid` holds four columns inside `.wrap`; the grid drops to three and then two. */
export const AIDREAMCAPES_V2_PICKER_CARD_SIZES = "(max-width: 560px) 255px, (max-width: 900px) 279px, 291px";

/** `.collage` holds two columns inside the second half of `.phero-grid`. */
export const AIDREAMCAPES_V2_COLLAGE_SIZES = "(max-width: 560px) 258px, (max-width: 900px) 424px, 282px";

/** `.tgrid` holds four columns inside `.wrap` and drops to three, two and one. */
export const AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES = "(max-width: 560px) 520px, (max-width: 760px) 352px, (max-width: 1020px) 316px, 288px";

/** `.actor-grid` holds two columns inside `.actor-main`, which is two columns of `.actor-layout`. */
export const AIDREAMCAPES_V2_ACTOR_CARD_SIZES = "(max-width: 640px) 305px, (max-width: 900px) 200px, 209px";

/** `.hx-source .hx-photo` is the product picture of the homepage hero block. */
export const AIDREAMCAPES_V2_HOME_PRODUCT_SIZES = "(max-width: 700px) 107px, 157px";

/** `.hx-phone` is the phone picture of the homepage hero block. */
export const AIDREAMCAPES_V2_HOME_PHONE_SIZES = "(max-width: 700px) 177px, 231px";
