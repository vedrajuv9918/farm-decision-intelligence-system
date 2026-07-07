from __future__ import annotations

from app.ml.predictor import crop_catalog, expense_anomaly_score
from app.schemas.common import ChartPoint, ExpenseAnalysisRequest, ExpenseInsight


class ExpenseService:
    def baselines_for_crop(self, crop: str) -> dict[str, float]:
        catalog = crop_catalog()
        crop_rows = catalog[catalog["crop"].str.lower() == crop.lower()]
        data = crop_rows if not crop_rows.empty else catalog
        cost = float(data["cost_per_acre"].median())
        return {
            "fertilizer": cost * 0.24,
            "labor": cost * 0.42,
            "irrigation": cost * 0.16,
        }

    def analyze(self, request: ExpenseAnalysisRequest) -> tuple[list[ExpenseInsight], list[ChartPoint], float]:
        baselines = self.baselines_for_crop(request.crop)
        per_acre = {
            "fertilizer": request.fertilizer_cost / request.acreage,
            "labor": request.labor_cost / request.acreage,
            "irrigation": request.irrigation_cost / request.acreage,
        }
        insights: list[ExpenseInsight] = []
        for category, cost in per_acre.items():
            baseline = baselines[category]
            deviation = ((cost - baseline) / baseline) * 100
            if deviation > 20:
                insights.append(
                    ExpenseInsight(
                        category=category.title(),
                        alert=f"{category.title()} cost is {deviation:.1f}% higher than {request.crop} benchmark",
                        suggestion=f"Audit {category} usage for {request.crop} and target a 10-15% reduction before the next input cycle.",
                        deviation_percent=round(deviation, 2),
                    )
                )
            elif deviation < -15:
                insights.append(
                    ExpenseInsight(
                        category=category.title(),
                        alert=f"{category.title()} spend is below the {request.crop} benchmark",
                        suggestion=f"Confirm quality and adequacy so lower {category} spend does not reduce {request.crop} yield.",
                        deviation_percent=round(deviation, 2),
                    )
                )

        if not insights:
            insights.append(
                ExpenseInsight(
                    category="Overall",
                    alert="Expenses are within expected benchmark ranges",
                    suggestion="Maintain current spend discipline and compare vendor quotes before purchase.",
                    deviation_percent=0,
                )
            )

        comparison = [
            ChartPoint(label="Fertilizer", value=round(per_acre["fertilizer"], 2)),
            ChartPoint(label="Fertilizer benchmark", value=round(baselines["fertilizer"], 2)),
            ChartPoint(label="Labor", value=round(per_acre["labor"], 2)),
            ChartPoint(label="Labor benchmark", value=round(baselines["labor"], 2)),
            ChartPoint(label="Irrigation", value=round(per_acre["irrigation"], 2)),
            ChartPoint(label="Irrigation benchmark", value=round(baselines["irrigation"], 2)),
        ]
        score = expense_anomaly_score(per_acre["fertilizer"], per_acre["labor"], per_acre["irrigation"])
        return insights, comparison, score
