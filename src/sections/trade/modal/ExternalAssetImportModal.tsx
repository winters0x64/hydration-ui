import { TExternal, useAssets } from "api/assetDetails"
import { useExternalAssetRegistry } from "api/externalAssetRegistry"
import { Modal } from "components/Modal/Modal"
import { useModalPagination } from "components/Modal/Modal.utils"
import { ModalContents } from "components/Modal/contents/ModalContents"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  TExternalAsset,
  useUserExternalTokenStore,
} from "sections/wallet/addToken/AddToken.utils"
import { AddTokenFormModal } from "sections/wallet/addToken/modal/AddTokenFormModal"
import { isNotNil } from "utils/helpers"

type Props = {
  assetIds: string[]
  onClose?: () => void
}

export const ExternalAssetImportModal: React.FC<Props> = ({
  assetIds = [],
  onClose,
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const { external, getAssets } = useAssets()
  const { isAdded } = useUserExternalTokenStore()
  const { page, direction, paginateTo } = useModalPagination()

  const externalAssets = useExternalAssetRegistry()

  const assetsMeta = getAssets(assetIds) as TExternal[]
  const assetsToAddRef = useRef<TExternalAsset[]>([])

  const onCloseHandler = () => {
    setIsOpen(false)
    onClose?.()
  }

  useEffect(() => {
    const assetsToAdd = assetsMeta
      .filter((meta) => {
        if (!meta) return false
        const { id, externalId } = meta
        const isChainStored = external.some((asset) => asset.id === id)
        const isUserStored = isAdded(externalId)
        return isChainStored && !isUserStored
      })
      .map(({ parachainId, externalId }) => {
        if (!parachainId) return null
        const assets = externalAssets?.[+parachainId]
        return assets?.data?.find(({ id }) => id === externalId)
      })
      .filter(isNotNil)

    if (assetsToAdd.length > 0 && assetsToAddRef.current.length === 0) {
      assetsToAddRef.current = assetsToAdd
      setIsOpen(true)
    }
  }, [external, assetsMeta, externalAssets, isAdded])

  return (
    <Modal open={isOpen} disableCloseOutside={true} onClose={onCloseHandler}>
      <ModalContents
        page={page}
        direction={direction}
        onClose={onCloseHandler}
        contents={assetsToAddRef.current.map((asset, index) => ({
          title: t("wallet.assets.table.addToken"),
          headerVariant: "GeistMono",
          content: (
            <AddTokenFormModal
              asset={asset}
              onClose={() => {
                if (index === assetsToAddRef.current.length - 1) {
                  onCloseHandler()
                } else {
                  paginateTo(index + 1)
                }
              }}
            />
          ),
        }))}
      />
    </Modal>
  )
}
