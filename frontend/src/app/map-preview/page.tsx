import Link from "next/link";
import { MapPinIcon } from "@/components/icons";
import { NaverMap } from "@/components/naver-map";

const previewLocations = [
  {
    id: "map-preview-seoul",
    placeName: "ソウル地図テスト地点",
    latitude: 37.5665,
    longitude: 126.978,
  },
];

export default function MapPreviewPage() {
  return (
    <main className="page-shell" id="main-content">
      <div className="page-narrow">
        <div className="page-heading">
          <p className="eyebrow">NAVER MAPS CHECK</p>
          <h1>地図の表示を確認</h1>
          <p className="lede">
            NAVER MapsのクライアントIDとWebサービスURLが正しく設定されているか確認するためのページです。
          </p>
        </div>

        <section className="map-preview-section" aria-labelledby="map-preview-title">
          <div className="map-preview-heading">
            <div>
              <h2 id="map-preview-title">
                <MapPinIcon aria-hidden="true" />
                ソウルのテスト地図
              </h2>
              <p>地図と「1」のマーカーが表示されれば、ブラウザ用の地図認証は正常です。</p>
            </div>
            <Link className="button button-secondary" href="/">
              プランナーへ戻る
            </Link>
          </div>
          <NaverMap stops={previewLocations} />
          <p className="map-preview-note">
            この座標は地図表示確認専用で、旅行の推薦候補や実際の混雑データには使用しません。
          </p>
        </section>
      </div>
    </main>
  );
}
