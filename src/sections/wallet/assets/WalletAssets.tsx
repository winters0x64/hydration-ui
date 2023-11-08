import { Spacer } from "components/Spacer/Spacer"
import { WalletAssetsTablePlaceholder } from "sections/wallet/assets/table/placeholder/WalletAssetsTablePlaceholder"
import { useAccountStore } from "state/store"
import { WalletFarmingPositionsWrapper } from "./farmingPositions/wrapper/WalletFarmingPositionsWrapper"
import { WalletAssetsPositionsWrapper } from "./hydraPositions/WalletAssetsPositionsWrapper"
import { WalletAssetsTableWrapper } from "./table/WalletAssetsTableWrapper"
import { WalletAssetsHeader } from "./header/WalletAssetsHeader"
import { WalletAssetsTableSkeleton } from "./table/skeleton/WalletAssetsTableSkeleton"
import { WalletAssetsHydraPositionsSkeleton } from "./hydraPositions/skeleton/WalletAssetsHydraPositionsSkeleton"
import { WalletFarmingPositionsSkeleton } from "./farmingPositions/skeleton/WalletFarmingPositionsSkeleton"
import { useRpcProvider } from "providers/rpcProvider"
import { MyActiveBonds } from "sections/trade/sections/bonds/MyActiveBonds"
import { Skeleton as BondsTableSkeleton } from "sections/trade/sections/bonds/table/skeleton/Skeleton"
import { useTranslation } from "react-i18next"
import { WalletAssetsFilters } from "sections/wallet/assets/filter/WalletAssetsFilters"
import { useWalletAssetsFilters } from "sections/wallet/assets/WalletAssets.utils"

const enabledBonds = import.meta.env.VITE_FF_BONDS_ENABLED === "true"

export const WalletAssets = () => {
  const { t } = useTranslation()
  const { account } = useAccountStore()
  const { isLoaded } = useRpcProvider()

  const { category, search } = useWalletAssetsFilters()

  const isAllVisible = category === "all"
  const isAssetsVisible = isAllVisible || category === "assets"
  const isLiquidityVisible = isAllVisible || category === "liquidity"
  const isFarmingVisible = isAllVisible || category === "farming"

  if (!isLoaded) {
    return (
      <div>
        <WalletAssetsHeader />
        <WalletAssetsFilters />
        <WalletAssetsTableSkeleton />
        <Spacer axis="vertical" size={20} />
        {enabledBonds && (
          <>
            <BondsTableSkeleton title={t("bonds.table.title")} />
            <Spacer axis="vertical" size={20} />
          </>
        )}

        <WalletAssetsHydraPositionsSkeleton />
        <Spacer axis="vertical" size={20} />
        <WalletFarmingPositionsSkeleton />
      </div>
    )
  }

  return (
    <div>
      {!account ? (
        <>
          <WalletAssetsHeader disconnected />
          <WalletAssetsTablePlaceholder />
        </>
      ) : (
        <>
          <WalletAssetsHeader />
          <WalletAssetsFilters />

          {isAssetsVisible && (
            <>
              <WalletAssetsTableWrapper />
              {enabledBonds && (
                <>
                  <Spacer axis="vertical" size={20} />
                  <MyActiveBonds showTransfer search={search} />
                </>
              )}
            </>
          )}

          {isAllVisible && <Spacer axis="vertical" size={20} />}
          {isLiquidityVisible && <WalletAssetsPositionsWrapper />}

          {isAllVisible && <Spacer axis="vertical" size={20} />}
          {isFarmingVisible && <WalletFarmingPositionsWrapper />}
        </>
      )}
    </div>
  )
}
