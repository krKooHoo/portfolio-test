using System;
using System.Collections.Generic;
using System.Linq;

namespace Game.Crafting
{
    public interface ICraftingService
    {
        event Action<CraftingResult> OnCraftCompleted;
        void RequestCraft(string recipeId);
    }

    public sealed class CraftingManager : ICraftingService
    {
        private readonly Inventory inventory;
        private readonly IReadOnlyList<Recipe> recipes;
        private readonly Func<float> roll; // 0.0 ~ 1.0, 테스트 주입 가능

        public event Action<CraftingResult> OnCraftCompleted;

        public CraftingManager(Inventory inventory, IReadOnlyList<Recipe> recipes, Func<float> roll)
        {
            this.inventory = inventory;
            this.recipes = recipes;
            this.roll = roll;
        }

        // 표현식 본문 + LINQ로 레시피 조회
        private Recipe FindRecipe(string recipeId) =>
            recipes.FirstOrDefault(r => r.Id == recipeId);

        public void RequestCraft(string recipeId)
        {
            var recipe = FindRecipe(recipeId);
            if (recipe == null)
            {
                Publish(CraftingResult.Fail(recipeId, "레시피를 찾을 수 없습니다."));
                return;
            }

            // (Why) 소비 전에 먼저 검증 → 방어적 처리로 재료 유실 방지
            if (!inventory.HasIngredients(recipe.Ingredients))
            {
                Publish(CraftingResult.Fail(recipeId, "재료가 부족합니다."));
                return;
            }

            // (Why) 확률 판정을 주입된 roll로 분리 → 테스트 시 결정론적 검증 가능
            var success = roll() < recipe.SuccessRate;

            // (Why) 성공/실패에 따라 소비율을 달리해 '실패 페널티' 규칙을 표현
            var ratio = success ? 1.0f : 0.5f;
            inventory.Consume(recipe.Ingredients, ratio);

            if (success)
                inventory.Add(recipe.Result);

            Publish(success
                ? CraftingResult.Success(recipeId, recipe.Result)
                : CraftingResult.Fail(recipeId, "제작에 실패했습니다."));
        }

        // 이벤트 발행을 한 곳으로 모아 null 체크 중복 제거
        private void Publish(CraftingResult result) =>
            OnCraftCompleted?.Invoke(result);
    }
}
