import QRCode from "https://esm.sh/qrcode";
const url = await QRCode.toDataURL("test");
console.log(url);
