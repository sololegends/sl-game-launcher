<template>
  <v-card
    :class="'game-card' + (active?' active':'') "
    :title="title"
    @mouseover="$emit('mouseover', $event)"
  >
    <div class="image">
      <slot>
        <v-progress-circular style="margin:auto" indeterminate size="80"  v-if="image === undefined" />
        <fa-icon v-else-if="image === '404'" class="remote-icon" size="5x" icon="cloud-download-alt" />
        <img v-else :src="image" width="200" />
      </slot>
    </div>
    <div :class="name_class">
      <slot name="name">
        <span :title="name">{{name}}</span>
      </slot>
    </div>

    <div class="note" v-if="note">
      {{note}}
    </div>

  </v-card>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";

export default defineComponent({
  props: {
    active: {
      type: Boolean,
      required: false,
      default: false
    },
    image: {
      type: String,
      required: false,
      default: undefined
    },
    title: {
      type: String,
      required: false,
      default: undefined
    },
    name: {
      type: String,
      required: false,
      default: undefined
    },
    note: {
      type: String,
      required: false,
      default: undefined
    }
  },
  data(){
    return {
    };
  },
  computed: {
    name_class(): string{
      return "name" + (this.active ? " active" : "");
    }
  },
  methods: {
  }
});
</script>

<style scoped>
	.game-card{
		margin: 8px;
		width: 200px;
		height: 175px;
		max-width: 200px;
		max-height: 175px;
		border-radius: 5px;
		background-color: var(--v-data-table-hover-base);
		cursor: pointer;
		box-shadow: 0px 2px 1px -1px rgb(0 0 0 / 20%),
			0px 1px 1px 0px rgb(0 0 0 / 14%),
			0px 1px 3px 0px rgb(0 0 0 / 12%);
		transition: 0.1s;
    border-color: rgba(0,0,0,0);
		display: flex;
		flex-direction: column;
		text-align: center;
	}

  .game-cards:hover, .game-card.active{
    outline: 4px solid #000;
    outline-color: var(--v-success-base);
		box-shadow: 0px 2px 4px -1px rgb(0 0 0 / 20%),
		0px 4px 5px 0px rgb(0 0 0 / 14%),
		0px 1px 10px 0px rgb(0 0 0 / 12%);
  }

	.image{
    display: flex;
		width: 200px;
		height: 120px;
    border-bottom:1px solid rgba(140, 130, 115, 0.42);
	}
  .image>img{
		border-top-left-radius: 5px;
		border-top-right-radius: 5px;
  }

	.image>.v-progress-circular{
		margin-top:10px;
	}
	.image.uninstalled{
		opacity: 0.8;
	}

	.name{
		font-size: 14px;
		font-weight:bold;
		flex-grow:1;
		vertical-align: middle;
    display: flex;
    justify-content: space-around;
    align-items: center;
	}
	.name.active{
		background-color: var(--v-success-base)!important;
		border-bottom-left-radius: 5px;
		border-bottom-right-radius: 5px;
	}
	.name>span{
		max-height: 55px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

  .note{
    font-size: 10px;
    position: absolute;
    padding: 0px 5px;
    left: 0px;
    bottom: 0px;
		border-top-right-radius: 5px;
		border-bottom-left-radius: 5px;
    background-color: rgba(0, 0, 0, 0.5);
  }
</style>