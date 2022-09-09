<template>
  <div id="date_range_picker">
    <v-dialog
      ref="dialog"
      v-model="display_date_picker"
      persistent
      width="290px"
    >
      <template v-slot:activator="{ }">
        <v-text-field
          :value="dateRangeText"
          :label="name"
          append-icon="$veutify.icons.calendar"
          readonly clearable
          @click:clear="clickClear()"
          @click:append="display_date_picker = true"
          @click="display_date_picker = true"
        ></v-text-field>
      </template>
      <v-date-picker
        :id="id"
        v-if="display_date_picker"
        v-model="date_range"
        @input="changeDateValue"
        range no-title
        :max="today()"
      >
        <v-btn
          text
          color="primary"
          @click="clickClear()"
        >
          Clear
        </v-btn>
        <v-btn
          id="ok_button"
          text
          color="primary"
          :disabled="invalidDateRange"
          @click="clickOk()"
        >
          OK
        </v-btn>
      </v-date-picker>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";

export default defineComponent({
  name: "DateRangePicker",
  props: {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    value: {
      type: Array as ()=> Array<string>,
      required: true
    }
  },
  data(){
    return{
      display_date_picker: false,
      date_range: this.value
    };
  },
  computed: {
    invalidDateRange(): boolean{
      return this.date_range?.length === 0;
    },
    sortedDates(): Array<string>{
      let tmp_date_range = [] as Array<string>;
      if(this.date_range !== undefined){
        tmp_date_range = [...this.date_range];
      }
      return tmp_date_range.sort();
    },
    dateRangeText(): string{
      return this.sortedDates.join(" ~ ");
    }
  },
  methods: {
    clickOk(): void{
      this.display_date_picker = false;
      this.$emit("input", this.sortedDates);
    },
    clickClear(): void{
      this.display_date_picker = false;
      this.date_range = [];
      this.$emit("input", []);
    },
    changeDateValue(): void{
      this.$emit("input", this.sortedDates);
    },
    today(): string{
      const currentDate = new Date();
      return currentDate.toISOString();
    }
  }
});
</script>
