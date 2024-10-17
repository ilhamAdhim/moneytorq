"use client";
import { IFormDataManageCategory } from "@/components/composites/Modals/ModalManageCategory";
import { Badge } from "@radix-ui/themes";
import { Button } from "@/components/ui/button";
import { TypographyH4 } from "@/components/ui/Typography/Heading4";
import { useDisclosure } from "@/hooks/useDisclosure";
import { ICategoryResponse } from "@/types/category";
import { formatRupiah } from "@/utils/common";
import { Box, Flex } from "@radix-ui/themes";
import { Edit2Icon, PlusIcon, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PieChartSpent from "@/app/(group-feature)/transaction/PiechartSpent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "@/actions/categories";
import { useScreenDetector } from "@/hooks/useScreenWidth";
import { Separator } from "@/components/ui/separator";
import TableCategoriesView from "@/app/(group-feature)/budgeting/TableCategories";
import { getTotalIncomeLast30Days } from "@/actions/transactions";
import { subDays, format } from "date-fns";
import SheetManageIncome from "@/components/composites/Sheets/SheetManageIncome";
import ResponsiveManageCategory from "@/components/composites/ResponsiveView/ResponsiveManageCategory";
import { availableBudgetPercentageAtom, availableBudgetRupiahAtom } from "@/store";
import { useSetAtom } from "jotai/react";

interface IBudgetingView {
  categoryExpenses: ICategoryResponse[];
  dataTotalIncome: any;
  dataTotalPercentage: any;
  error: any;
}

function BudgetingView({ categoryExpenses, dataTotalIncome, dataTotalPercentage }: IBudgetingView) {
  const { isTablet } = useScreenDetector();
  const [valueIncome, setValueIncome] = useState(0);

  const [categoryExpensesList, setCategoryExpensesList] = useState<ICategoryResponse[]>([]);
  const [totalPercentage, setTotalPercentage] = useState(dataTotalPercentage);
  const [selectedCategory, setSelectedCategory] = useState<ICategoryResponse | null>(null);
  const setAvailableBudgetPercentage = useSetAtom(availableBudgetPercentageAtom);
  const setAvailableBudgetRupiah = useSetAtom(availableBudgetRupiahAtom);

  const availableBudgetPercentage = useMemo(() => 100 - totalPercentage, [totalPercentage]);
  const availableBudgetRupiah = useMemo(
    () => ((100 - totalPercentage) / 100) * valueIncome,
    [totalPercentage, valueIncome]
  );

  useEffect(() => {
    setAvailableBudgetPercentage(availableBudgetPercentage);
    setAvailableBudgetRupiah(availableBudgetRupiah);
  }, [availableBudgetPercentage, availableBudgetRupiah]);

  const dataPieChart = useMemo(() => {
    const dataCategory = categoryExpensesList.map((item, id) => {
      return {
        id: id + 2,
        label: item.category_title,
        value: item.percentage_amount,
        fill: `var(--chart-${id + 2})`,
      };
    });

    return [
      ...dataCategory,
      {
        id: 0,
        label: "Available",
        value: 100 - totalPercentage,
        fill: `var(--chart-1)`,
      },
    ];
  }, [categoryExpensesList, totalPercentage]);

  const refetchDataCategories = async () => {
    const {
      queryCategories: { data },
      queryTotalPercentage: { data: dataPercentage },
    } = await getCategories({
      type: "expenses",
    });
    if (data) setCategoryExpensesList(data);

    if (dataPercentage) setTotalPercentage(dataPercentage);
  };

  const drawerManageIncome = useDisclosure();
  const modalManageCategory = useDisclosure();
  const modalDeleteCategory = useDisclosure();

  const refetchTotalIncome = async () => {
    const { data: dataTotalIncome } = await getTotalIncomeLast30Days({
      startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    });
    setValueIncome(dataTotalIncome);
  };

  useEffect(() => {
    setValueIncome(dataTotalIncome);
    setCategoryExpensesList(categoryExpenses);
  }, [dataTotalIncome, categoryExpenses]);

  useEffect(() => {
    if (!drawerManageIncome.isOpen) refetchTotalIncome();
  }, [drawerManageIncome.isOpen]);

  const handleSubmit = async (formData: IFormDataManageCategory) => {
    try {
      let percentageBelow100 = selectedCategory
        ? Number(totalPercentage) -
            Number(selectedCategory.percentage_amount) +
            Number(formData.percentage_amount) >
          100
        : Number(totalPercentage) + Number(formData.percentage_amount) > 100;

      if (percentageBelow100) throw Error("Your budget is more than 100% ?");

      const { budget_type, percentage_amount, rupiah_amount, ...restFormData } = formData;
      const payload = {
        ...restFormData,
        budget_type,
        // ? Check if budget_type === 'percentage' then use the value from formData. Else manually calculate from available budget
        percentage_amount:
          budget_type === "percentage"
            ? formData.percentage_amount
            : Math.round((formData?.rupiah_amount ?? 0) / valueIncome),
        rupiah_amount:
          budget_type === "rupiah"
            ? formData.rupiah_amount
            : Math.round(((formData?.percentage_amount ?? 0) / 100) * valueIncome),
      };

      let query;
      if (selectedCategory) query = await updateCategory(payload, selectedCategory.category_id);
      else query = await createCategory(payload);

      refetchDataCategories();
      toast.success(`Category ${selectedCategory ? "Updated" : "Created"}!`);
    } catch (error) {
      console.error(error);
      toast.error(`Cannot ${selectedCategory ? "Update" : "Create"} Category | ${error}`);
    } finally {
      modalManageCategory.close();
    }
  };

  const handleRemoveCategory = async () => {
    try {
      if (selectedCategory) {
        const { error } = await deleteCategory(selectedCategory.category_id);
        if (error) throw Error(error.message);

        modalDeleteCategory.close();
        refetchDataCategories();
        toast.success(`Category ${selectedCategory.category_title} deleted!`);
      }
    } catch (error) {
      toast.error(`Cannot delete category`, {
        description: `${error}`,
      });
    }
  };

  const handleOpenCreateCategory = () => {
    setSelectedCategory(null);
    modalManageCategory.open();
  };

  const handleOpenEditCategory = (item: ICategoryResponse) => {
    setSelectedCategory(item);
    modalManageCategory.open();
  };

  const handleOpenDeleteCategory = (item: ICategoryResponse) => {
    setSelectedCategory(item);
    modalDeleteCategory.open();
  };

  return (
    <>
      <div className="flex flex-col md:flex-row items-center justify-between space-y-2">
        <h2 className="text-xl lg:text-3xl font-bold tracking-tight">Budgeting</h2>
        <Flex gap="4" className="justify-between md:justify-start">
          <Box className="my-auto">
            <TypographyH4> Your Income </TypographyH4>
          </Box>
          <Flex gap="4">
            <div className="my-auto">
              <Badge className="p-1 rounded-lg" color="green">
                {formatRupiah(valueIncome || 0)}
              </Badge>
            </div>
            <Button
              className="mx-auto"
              variant="outline"
              onClick={() => {
                setSelectedCategory(null);
                drawerManageIncome.open();
              }}
            >
              <Edit2Icon className="w-4" size="icon" />
            </Button>
          </Flex>
        </Flex>
      </div>

      <Separator />
      <Flex className="flex-col lg:flex-row" gap="6">
        <Card className="w-full lg:w-1/2">
          <CardHeader>
            <CardTitle className="flex gap-4">
              <Search />
              Overview{" "}
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2 lg:h-[400px]">
            <PieChartSpent data={dataPieChart} />
            <Box className="text-center my-4">
              Your Available budget is
              <b> {availableBudgetPercentage}% </b>
              {" or "}
              <b> {formatRupiah(availableBudgetRupiah)} </b>{" "}
            </Box>
          </CardContent>
        </Card>
        <Card className="w-full lg:w-1/2">
          <Flex className="p-4" justify="between">
            <h2 className="my-auto text-xl font-bold tracking-tight">Categories</h2>
            <Button
              size={isTablet ? "sm" : "default"}
              onClick={handleOpenCreateCategory}
              className="flex gap-2 bg-[var(--button-solid)]"
            >
              <PlusIcon color="white" />
              <div className="my-auto text-white">Add Records</div>
            </Button>
          </Flex>
          <Flex className="flex-col flex-wrap sm:flex-row my-6 mx-8" gap="4">
            <TableCategoriesView
              isExpense={false}
              dataCategoryList={categoryExpensesList}
              handleOpenModalEdit={handleOpenEditCategory}
              handleOpenModalDelete={handleOpenDeleteCategory}
            />
          </Flex>
        </Card>
      </Flex>

      <SheetManageIncome disclosure={drawerManageIncome} />

      {modalManageCategory.isOpen && (
        <ResponsiveManageCategory
          role={selectedCategory ? "edit" : "create"}
          selectedCategory={selectedCategory}
          disclosure={modalManageCategory}
          handleSubmit={handleSubmit}
        />
      )}

      {modalDeleteCategory.isOpen && (
        <ResponsiveManageCategory
          role={"delete"}
          selectedCategory={selectedCategory}
          disclosure={modalDeleteCategory}
          handleSubmit={handleRemoveCategory}
        />
      )}
    </>
  );
}

export default BudgetingView;
