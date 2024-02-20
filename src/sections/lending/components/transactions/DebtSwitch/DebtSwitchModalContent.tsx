import { InterestRate } from "@aave/contract-helpers"
import { valueToBigNumber } from "@aave/math-utils"
import { MaxUint256 } from "@ethersproject/constants"
import { ArrowDownIcon } from "@heroicons/react/outline"
import { ArrowNarrowRightIcon } from "@heroicons/react/solid"

import {
  Box,
  ListItemText,
  ListSubheader,
  Stack,
  SvgIcon,
  Typography,
} from "@mui/material"
import BigNumber from "bignumber.js"
import React, { useRef, useState } from "react"
import { GhoIncentivesCard } from "sections/lending/components/incentives/GhoIncentivesCard"
import { PriceImpactTooltip } from "sections/lending/components/infoTooltips/PriceImpactTooltip"
import { FormattedNumber } from "sections/lending/components/primitives/FormattedNumber"
import { ROUTES } from "sections/lending/components/primitives/Link"
import { TokenIcon } from "sections/lending/components/primitives/TokenIcon"
import { Warning } from "sections/lending/components/primitives/Warning"
import { Asset, AssetInput } from "sections/lending/ui/transactions/AssetInput"
import { TxModalDetails } from "sections/lending/components/transactions/FlowCommons/TxModalDetails"
import { useDebtSwitch } from "sections/lending/hooks/paraswap/useDebtSwitch"
import { useModalContext } from "sections/lending/hooks/useModal"
import { useProtocolDataContext } from "sections/lending/hooks/useProtocolDataContext"
import { useWeb3Context } from "sections/lending/libs/hooks/useWeb3Context"
import { ListSlippageButton } from "sections/lending/modules/dashboard/lists/SlippageList"
import { useRootStore } from "sections/lending/store/root"
import { CustomMarket } from "sections/lending/ui-config/marketsConfig"
import { assetCanBeBorrowedByUser } from "sections/lending/utils/getMaxAmountAvailableToBorrow"
import { weightedAverageAPY } from "sections/lending/utils/ghoUtilities"

import {
  ComputedUserReserveData,
  useAppDataContext,
} from "sections/lending/hooks/app-data-provider/useAppDataProvider"
import { ModalWrapperProps } from "sections/lending/components/transactions/FlowCommons/ModalWrapper"
import { TxSuccessView } from "sections/lending/components/transactions/FlowCommons/Success"
import { ParaswapErrorDisplay } from "sections/lending/components/transactions/Warnings/ParaswapErrorDisplay"
import { DebtSwitchActions } from "./DebtSwitchActions"
import { DebtSwitchModalDetails } from "./DebtSwitchModalDetails"

export type SupplyProps = {
  underlyingAsset: string
}

export interface GhoRange {
  qualifiesForDiscount: boolean
  userBorrowApyAfterMaxSwitch: number
  ghoApyRange?: [number, number]
  userDiscountTokenBalance: number
  inputAmount: number
  targetAmount: number
  userCurrentBorrowApy: number
  ghoVariableBorrowApy: number
  userGhoAvailableToBorrowAtDiscount: number
  ghoBorrowAPYWithMaxDiscount: number
  userCurrentBorrowBalance: number
}

interface SwitchTargetAsset extends Asset {
  variableApy: string
}

enum ErrorType {
  INSUFFICIENT_LIQUIDITY,
}

export const DebtSwitchModalContent = ({
  poolReserve,
  userReserve,
  isWrongNetwork,
  currentRateMode,
}: ModalWrapperProps & { currentRateMode: InterestRate }) => {
  const { reserves, user, ghoReserveData, ghoUserData } = useAppDataContext()
  const { currentChainId, currentNetworkConfig } = useProtocolDataContext()
  const { currentAccount } = useWeb3Context()
  const { gasLimit, mainTxState, txError, setTxError } = useModalContext()
  const [
    displayGho,
    currentMarket,
    ghoUserDataFetched,
    ghoUserQualifiesForDiscount,
  ] = useRootStore((state) => [
    state.displayGho,
    state.currentMarket,
    state.ghoUserDataFetched,
    state.ghoUserQualifiesForDiscount,
  ])

  let switchTargets = reserves
    .filter(
      (r) =>
        r.underlyingAsset !== poolReserve.underlyingAsset &&
        r.availableLiquidity !== "0" &&
        assetCanBeBorrowedByUser(r, user),
    )
    .map<SwitchTargetAsset>((reserve) => ({
      address: reserve.underlyingAsset,
      symbol: reserve.symbol,
      iconSymbol: reserve.iconSymbol,
      variableApy: reserve.variableBorrowAPY,
      priceInUsd: reserve.priceInUSD,
    }))

  switchTargets = [
    ...switchTargets.filter((r) => r.symbol === "GHO"),
    ...switchTargets.filter((r) => r.symbol !== "GHO"),
  ]

  // states
  const [_amount, setAmount] = useState("")
  const amountRef = useRef<string>("")
  const [targetReserve, setTargetReserve] = useState<Asset>(switchTargets[0])
  const [maxSlippage, setMaxSlippage] = useState("0.1")

  const switchTarget = user.userReservesData.find(
    (r) => r.underlyingAsset === targetReserve.address,
  ) as ComputedUserReserveData

  const maxAmountToSwitch =
    currentRateMode === InterestRate.Variable
      ? userReserve.variableBorrows
      : userReserve.stableBorrows

  const isMaxSelected = _amount === "-1"
  const amount = isMaxSelected ? maxAmountToSwitch : _amount

  const {
    inputAmount,
    outputAmount,
    outputAmountUSD,
    error,
    loading: routeLoading,
    buildTxFn,
  } = useDebtSwitch({
    chainId: currentNetworkConfig.underlyingChainId || currentChainId,
    userAddress: currentAccount,
    swapOut: { ...poolReserve, amount: amountRef.current },
    swapIn: { ...switchTarget.reserve, amount: "0" },
    max: isMaxSelected,
    skip: mainTxState.loading || false,
    maxSlippage: Number(maxSlippage),
  })

  const loadingSkeleton = routeLoading && outputAmountUSD === "0"

  const handleChange = (value: string) => {
    const maxSelected = value === "-1"
    amountRef.current = maxSelected ? maxAmountToSwitch : value
    setAmount(value)
    setTxError(undefined)
  }

  // TODO consider pulling out a util helper here or maybe moving this logic into the store
  let availableBorrowCap = valueToBigNumber(MaxUint256.toString())
  let availableLiquidity: string | number = "0"
  if (displayGho({ symbol: switchTarget.reserve.symbol, currentMarket })) {
    availableLiquidity =
      ghoReserveData.aaveFacilitatorRemainingCapacity.toString()
  } else {
    availableBorrowCap =
      switchTarget.reserve.borrowCap === "0"
        ? valueToBigNumber(MaxUint256.toString())
        : valueToBigNumber(Number(switchTarget.reserve.borrowCap)).minus(
            valueToBigNumber(switchTarget.reserve.totalDebt),
          )
    availableLiquidity = switchTarget.reserve.formattedAvailableLiquidity
  }

  const availableLiquidityOfTargetReserve = BigNumber.max(
    BigNumber.min(availableLiquidity, availableBorrowCap),
    0,
  )

  const poolReserveAmountUSD = Number(amount) * Number(poolReserve.priceInUSD)
  const targetReserveAmountUSD =
    Number(inputAmount) * Number(targetReserve.priceInUsd)

  const priceImpactDifference: number =
    targetReserveAmountUSD - poolReserveAmountUSD
  const insufficientCollateral =
    Number(user.availableBorrowsUSD) === 0 ||
    priceImpactDifference > Number(user.availableBorrowsUSD)

  let blockingError: ErrorType | undefined = undefined
  if (BigNumber(inputAmount).gt(availableLiquidityOfTargetReserve)) {
    blockingError = ErrorType.INSUFFICIENT_LIQUIDITY
  }

  const BlockingError: React.FC = () => {
    switch (blockingError) {
      case ErrorType.INSUFFICIENT_LIQUIDITY:
        return (
          <span>
            There is not enough liquidity for the target asset to perform the
            switch. Try lowering the amount.
          </span>
        )
      default:
        return null
    }
  }

  if (mainTxState.success)
    return (
      <TxSuccessView
        customAction={
          <Stack gap={3}>
            <Typography variant="description" color="text.primary">
              <span>You&apos;ve successfully switched borrow position.</span>
            </Typography>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              gap={1}
            >
              <TokenIcon symbol={poolReserve.iconSymbol} sx={{ mx: 4 }} />
              <FormattedNumber
                value={amountRef.current}
                compact
                variant="subheader1"
              />
              {poolReserve.symbol}
              <SvgIcon color="primary" sx={{ fontSize: "14px", mx: 4 }}>
                <ArrowNarrowRightIcon />
              </SvgIcon>
              <TokenIcon
                symbol={switchTarget.reserve.iconSymbol}
                sx={{ mx: 4 }}
              />
              <FormattedNumber
                value={inputAmount}
                compact
                variant="subheader1"
              />
              {switchTarget.reserve.symbol}
            </Stack>
          </Stack>
        }
      />
    )

  let qualifiesForDiscount = false
  let ghoTargetData: GhoRange | undefined
  if (reserves.some((reserve) => reserve.symbol === "GHO")) {
    const ghoBalanceAfterMaxSwitchTo =
      Number(maxAmountToSwitch) * Number(poolReserve.priceInUSD) +
      ghoUserData.userGhoBorrowBalance
    const userCurrentBorrowApy = weightedAverageAPY(
      ghoReserveData.ghoVariableBorrowAPY,
      ghoUserData.userGhoBorrowBalance,
      ghoUserData.userGhoAvailableToBorrowAtDiscount,
      ghoReserveData.ghoBorrowAPYWithMaxDiscount,
    )
    const userBorrowApyAfterMaxSwitchTo = weightedAverageAPY(
      ghoReserveData.ghoVariableBorrowAPY,
      ghoBalanceAfterMaxSwitchTo,
      ghoUserData.userGhoAvailableToBorrowAtDiscount,
      ghoReserveData.ghoBorrowAPYWithMaxDiscount,
    )
    const ghoApyRange: [number, number] | undefined = ghoUserDataFetched
      ? [userCurrentBorrowApy, userBorrowApyAfterMaxSwitchTo]
      : undefined
    qualifiesForDiscount = ghoUserQualifiesForDiscount(maxAmountToSwitch)
    ghoTargetData = {
      qualifiesForDiscount,
      ghoApyRange,
      userBorrowApyAfterMaxSwitch: userBorrowApyAfterMaxSwitchTo,
      userDiscountTokenBalance: ghoUserData.userDiscountTokenBalance,
      inputAmount: Number(amount),
      targetAmount: Number(inputAmount),
      userCurrentBorrowApy,
      ghoVariableBorrowApy: ghoReserveData.ghoVariableBorrowAPY,
      userGhoAvailableToBorrowAtDiscount:
        ghoUserData.userGhoAvailableToBorrowAtDiscount,
      ghoBorrowAPYWithMaxDiscount: ghoReserveData.ghoBorrowAPYWithMaxDiscount,
      userCurrentBorrowBalance: ghoUserData.userGhoBorrowBalance,
    }
  }

  return (
    <>
      <AssetInput
        name="debt-switch-1"
        value={amount}
        onChange={handleChange}
        usdValue={poolReserveAmountUSD.toString()}
        symbol={poolReserve.symbol}
        assets={[
          {
            balance: maxAmountToSwitch,
            address: poolReserve.underlyingAsset,
            symbol: poolReserve.symbol,
            iconSymbol: poolReserve.iconSymbol,
          },
        ]}
        maxValue={maxAmountToSwitch}
        inputTitle={<span>Borrowed asset amount</span>}
        balanceText={
          <React.Fragment>
            <span>Borrow balance</span>
          </React.Fragment>
        }
        isMaxSelected={isMaxSelected}
      />
      <Box
        sx={{
          padding: "18px",
          pt: "14px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <SvgIcon sx={{ fontSize: "18px !important" }}>
          <ArrowDownIcon />
        </SvgIcon>

        {/** For debt switch, targetAmountUSD (input) > poolReserveAmountUSD (output) means that more is being borrowed to cover the current borrow balance as exactOut, so this should be treated as positive impact */}
        <PriceImpactTooltip
          loading={loadingSkeleton}
          outputAmountUSD={targetReserveAmountUSD.toString()}
          inputAmountUSD={poolReserveAmountUSD.toString()}
        />
      </Box>
      <AssetInput<SwitchTargetAsset>
        name="debt-switch-2"
        value={inputAmount}
        onSelect={setTargetReserve}
        usdValue={targetReserveAmountUSD.toString()}
        symbol={targetReserve.symbol}
        assets={switchTargets}
        inputTitle={<span>Switch to</span>}
        balanceText={<span>Supply balance</span>}
        disableInput
        loading={loadingSkeleton}
        selectOptionHeader={<SelectOptionListHeader />}
        selectOption={(asset) =>
          asset.symbol === "GHO" ? (
            <GhoSwitchTargetSelectOption
              asset={asset}
              ghoApyRange={ghoTargetData?.ghoApyRange}
              userBorrowApyAfterMaxSwitch={
                ghoTargetData?.userBorrowApyAfterMaxSwitch
              }
              userDiscountTokenBalance={ghoUserData.userDiscountTokenBalance}
              currentMarket={currentMarket}
              qualifiesForDiscount={qualifiesForDiscount}
            />
          ) : (
            <SwitchTargetSelectOption asset={asset} />
          )
        }
      />
      {error && !loadingSkeleton && (
        <Typography variant="helperText" color="error.main">
          {error}
        </Typography>
      )}
      {!error && blockingError !== undefined && (
        <Typography variant="helperText" color="error.main">
          <BlockingError />
        </Typography>
      )}

      <TxModalDetails
        gasLimit={gasLimit}
        slippageSelector={
          <ListSlippageButton
            selectedSlippage={maxSlippage}
            setSlippage={(newMaxSlippage) => {
              setTxError(undefined)
              setMaxSlippage(newMaxSlippage)
            }}
          />
        }
      >
        <DebtSwitchModalDetails
          switchSource={userReserve}
          switchTarget={switchTarget}
          toAmount={inputAmount}
          fromAmount={amount === "" ? "0" : amount}
          loading={loadingSkeleton}
          sourceBalance={maxAmountToSwitch}
          sourceBorrowAPY={
            currentRateMode === InterestRate.Variable
              ? poolReserve.variableBorrowAPY
              : poolReserve.stableBorrowAPY
          }
          targetBorrowAPY={switchTarget.reserve.variableBorrowAPY}
          showAPYTypeChange={
            currentRateMode === InterestRate.Stable ||
            userReserve.reserve.symbol === "GHO" ||
            switchTarget.reserve.symbol === "GHO"
          }
          ghoData={ghoTargetData}
          currentMarket={currentMarket}
        />
      </TxModalDetails>

      {txError && <ParaswapErrorDisplay txError={txError} />}

      {insufficientCollateral && (
        <Warning variant="error" sx={{ mt: 4 }}>
          <Typography variant="caption">
            <span>
              Insufficient collateral to cover new borrow position. Wallet must
              have borrowing power remaining to perform debt switch.
            </span>
          </Typography>
        </Warning>
      )}

      <DebtSwitchActions
        isMaxSelected={isMaxSelected}
        poolReserve={poolReserve}
        amountToSwap={outputAmount}
        amountToReceive={inputAmount}
        isWrongNetwork={isWrongNetwork}
        targetReserve={switchTarget.reserve}
        symbol={poolReserve.symbol}
        blocked={
          blockingError !== undefined || error !== "" || insufficientCollateral
        }
        loading={routeLoading}
        buildTxFn={buildTxFn}
        currentRateMode={currentRateMode === InterestRate.Variable ? 2 : 1}
      />
    </>
  )
}

const SelectOptionListHeader = () => {
  return (
    <ListSubheader
      sx={(theme) => ({
        borderBottom: `1px solid ${theme.palette.divider}`,
        mt: -1,
      })}
    >
      <Stack direction="row" sx={{ py: 4 }} gap={14}>
        <Typography variant="subheader2">
          <span>Select an asset</span>
        </Typography>
        <Typography variant="subheader2">
          <span>Borrow APY</span>
        </Typography>
      </Stack>
    </ListSubheader>
  )
}

const SwitchTargetSelectOption = ({ asset }: { asset: SwitchTargetAsset }) => {
  return (
    <>
      <TokenIcon
        aToken={asset.aToken}
        symbol={asset.iconSymbol || asset.symbol}
        sx={{ fontSize: "22px", mr: 16 }}
      />
      <ListItemText sx={{ mr: 24 }}>{asset.symbol}</ListItemText>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
        <FormattedNumber
          value={asset.variableApy}
          percent
          variant="main14"
          color="text.secondary"
        />
        <Typography variant="helperText" color="text.secondary">
          <span>Variable rate</span>
        </Typography>
      </Box>
    </>
  )
}

interface GhoSwitchTargetAsset {
  ghoApyRange?: [number, number]
  asset: SwitchTargetAsset
  userBorrowApyAfterMaxSwitch?: number
  userDiscountTokenBalance: number
  currentMarket: CustomMarket
  qualifiesForDiscount: boolean
}

const GhoSwitchTargetSelectOption = ({
  ghoApyRange,
  asset,
  userBorrowApyAfterMaxSwitch,
  userDiscountTokenBalance,
  currentMarket,
  qualifiesForDiscount,
}: GhoSwitchTargetAsset) => {
  return (
    <>
      <TokenIcon
        aToken={asset.aToken}
        symbol={asset.iconSymbol || asset.symbol}
        sx={{ fontSize: "22px", mr: 16 }}
      />
      <ListItemText sx={{ mr: 24 }}>{asset.symbol}</ListItemText>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
        <GhoIncentivesCard
          useApyRange={qualifiesForDiscount}
          rangeValues={ghoApyRange}
          variant="main14"
          color="text.secondary"
          value={userBorrowApyAfterMaxSwitch ?? -1}
          data-cy={`apyType`}
          stkAaveBalance={userDiscountTokenBalance}
          ghoRoute={
            ROUTES.reserveOverview(asset?.address ?? "", currentMarket) +
            "/#discount"
          }
          forceShowTooltip
          withTokenIcon={qualifiesForDiscount}
          userQualifiesForDiscount={qualifiesForDiscount}
        />
        <Typography variant="helperText" color="text.secondary">
          <span>Fixed rate</span>
        </Typography>
      </Box>
    </>
  )
}
