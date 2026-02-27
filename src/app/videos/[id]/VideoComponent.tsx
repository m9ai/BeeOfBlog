'use client'
import { Play } from 'lucide-react';
import Image from 'next/image';

interface IProps {
  cover_image: string;
  title: string;  
}

const VideoComponent = (props: IProps) => {
    const {cover_image, title} = props

    return <div className="relative aspect-video rounded-xl overflow-hidden mb-8 bg-secondary">
        {cover_image && (
            <>
                <Image
                    src={cover_image}
                    alt={title}
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-primary-foreground ml-1" onClick={() => {
                            // 检查浏览器是否支持
                            if ('Notification' in window) {
                                // 请求权限
                                Notification.requestPermission().then(permission => {
                                    if (permission === 'granted') {
                                        new Notification('请微信扫码在视频号中看', {
                                            body: '请留意👀视频二维码在上方🔝',
                                            icon: '/favicon.png'
                                        });
                                    }
                                });
                            }
                        }} />
                    </div>
                </div>
            </>)
        }

    </div>
}

export default VideoComponent;