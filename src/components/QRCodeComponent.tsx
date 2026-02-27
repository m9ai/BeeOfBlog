import {QRCodeSVG} from 'qrcode.react';

const QRCodeComponent = ({ url, title }: { url: string, title?: string}) => {
  return (
    <QRCodeSVG
      title={title || '请用微信扫码查看'}
      value={url}                // 必填，要编码的内容（后端返回的 URL）
      size={200}                  // 二维码大小，默认 128
      bgColor="#ffffff"            // 背景色
      fgColor="#000000"            // 前景色（二维码点的颜色）
      level="L"                    // 纠错级别：L, M, Q, H
      marginSize={2}
      imageSettings={{
        src: '/qr-logo.jpeg',
        excavate: true,
        width: 24,
        height: 24,
        opacity: 1
      }}
    />
  );
};

export default QRCodeComponent;