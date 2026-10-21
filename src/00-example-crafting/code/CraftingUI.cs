using UnityEngine;

namespace Game.Crafting
{
    // 제작 서비스에 '요청'만 하고, 결과는 이벤트로 받는다
    public sealed class CraftingUI : MonoBehaviour
    {
        [SerializeField] private Toast toast;

        private ICraftingService crafting; // (Why) 구현체가 아닌 인터페이스에 의존 (DIP)

        // 조립 지점(Installer 등)에서 주입
        public void Construct(ICraftingService service) => crafting = service;

        private void OnEnable() =>
            crafting.OnCraftCompleted += HandleResult;

        private void OnDisable() =>
            crafting.OnCraftCompleted -= HandleResult;

        // 버튼 클릭 시 호출
        public void OnCraftButtonClicked(string recipeId) =>
            crafting.RequestCraft(recipeId);

        private void HandleResult(CraftingResult result) =>
            toast.Show(result.IsSuccess ? $"{result.Item.Name} 제작 성공!" : result.Reason);
    }
}
